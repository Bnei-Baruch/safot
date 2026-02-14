from abc import ABC, abstractmethod
from typing import TypedDict
import logging
from models import TranslationServiceOptions
from services.prompt import get_task_prompt, format_input, LANGUAGES

logger = logging.getLogger(__name__)

# Multiplier for translated text in other languages (including references)
OTHER_LANG_TEXT_MULTIPLIER = 1.5

# Safety margin for token limits to avoid hitting exact limits (90%)
SAFETY_MARGIN = 0.9


class TranslatedParagraph(TypedDict):
    id: int
    original_paragraph: str
    references: dict[str, str]
    translation: str


class TranslationResult(TypedDict):
    translated_paragraphs: list[str]
    references_by_language: dict[str, list[str]]
    remaining_additional_sources_texts: list[str]
    properties: dict


class BaseTranslationProvider(ABC):
    """Abstract base class for translation providers"""

    def __init__(self, api_key: str, options: TranslationServiceOptions):
        self.api_key = api_key
        self.options = options

    @abstractmethod
    def get_model_token_limit(self) -> dict:
        """
        Return context window and max output tokens for the model.

        Returns:
            Dict with keys: context_window, max_output_tokens
        """
        pass

    @abstractmethod
    def calculate_input_tokens(
        self,
        task_prompt: str,
        original_paragraphs: list[str],
        additional_sources_texts: list[str] | None = None
    ) -> int:
        """
        Calculate token count for input using provider-specific tokenizer.

        Args:
            task_prompt: Task prompt (Part 1)
            original_paragraphs: List of paragraphs to translate
            additional_sources_texts: Optional reference source texts

        Returns:
            Token count for entire input
        """
        pass

    @abstractmethod
    def estimate_output_tokens(self, original_paragraphs: list[str], num_references: int) -> int:
        """
        Estimate output tokens based on input size and reference count.

        Args:
            original_paragraphs: List of paragraphs to translate
            num_references: Number of reference sources

        Returns:
            Estimated output token count
        """
        pass

    @abstractmethod
    def send_for_translation(
        self,
        task_prompt: str,
        input_text: str,
        max_output_tokens: int,
    ) -> list[TranslatedParagraph]:
        """
        Send request to provider API.

        Args:
            task_prompt: Task prompt (Part 1) - system message
            input_text: Input text (Part 2) - user message
            max_output_tokens: Maximum tokens to allocate for output

        Returns:
            List of TranslatedParagraph objects from LLM response
        """
        pass

    # Shared methods that work for all providers

    def limit_additional_sources(
        self,
        paragraphs: list[str],
        additional_sources_texts: list[str] | None
    ) -> list[str] | None:
        """
        Limit additional sources text proportional to paragraphs being translated.
        Each source gets OTHER_LANG_TEXT_MULTIPLIER * paragraphs_size,
        allowing each source to contain references for all paragraphs.
        """
        if not additional_sources_texts:
            return None

        paragraphs_text = "\n".join(paragraphs)
        # Each source should be able to contain references to all paragraphs
        chars_per_source = int(len(paragraphs_text) * OTHER_LANG_TEXT_MULTIPLIER)

        return [text[:chars_per_source] for text in additional_sources_texts]

    def reduce_paragraphs_to_fit(
        self,
        task_prompt: str,
        paragraphs: list[str],
        additional_sources_texts: list[str] | None = None
    ) -> tuple[list[str], list[str] | None, int]:
        """
        Reduces paragraphs until they fit within both the model's context window
        and the organization's TPM rate limit.

        Uses binary search for efficient O(log n) complexity.

        Returns:
            Tuple of (paragraphs that fit, limited additional sources, max tokens available for output)
        """
        model_limits = self.get_model_token_limit()
        context_window = model_limits["context_window"]
        max_output_tokens = model_limits["max_output_tokens"]

        num_references = len(additional_sources_texts) if additional_sources_texts else 0
        tpm_limit = self.options.tpm_limit

        # Helper function to check if N paragraphs fit within limits
        def check_paragraphs_fit(num_paragraphs: int) -> tuple[bool, list[str] | None, int]:
            """Check if num_paragraphs fit, return (fits, limited_sources, available_output_tokens)"""
            if num_paragraphs == 0:
                return False, None, 0

            paragraphs_to_check = paragraphs[:num_paragraphs]

            # Limit additional sources proportional to paragraphs
            limited_sources = self.limit_additional_sources(paragraphs_to_check, additional_sources_texts)

            input_tokens = self.calculate_input_tokens(
                task_prompt, paragraphs_to_check, limited_sources
            )
            estimated_output = self.estimate_output_tokens(
                paragraphs_to_check, num_references
            )
            total_tokens = input_tokens + estimated_output

            logger.debug(f"Binary search check: {num_paragraphs} paras, "
                        f"input_tokens={input_tokens}, estimated_output={estimated_output}, "
                        f"total={total_tokens}, tpm_limit={tpm_limit}, max_output_tokens={max_output_tokens}")

            # Check TPM limit (input + output must fit under TPM)
            if tpm_limit > 0 and total_tokens > tpm_limit:
                return False, None, 0

            # Check if we fit within context window
            context_total = input_tokens + min(estimated_output, max_output_tokens)
            if context_total >= context_window * SAFETY_MARGIN:
                return False, None, 0

            available_output_tokens = min(max_output_tokens, context_window - input_tokens)

            # Ensure estimated output doesn't exceed available capacity (with safety margin)
            # Don't use more than SAFETY_MARGIN of available to avoid truncation
            if estimated_output > available_output_tokens * SAFETY_MARGIN:
                logger.debug(f"  Insufficient output tokens: estimated={estimated_output}, "
                           f"available={available_output_tokens}, safe_limit={available_output_tokens * SAFETY_MARGIN:.0f}")
                return False, None, 0

            return True, limited_sources, available_output_tokens

        # Binary search for maximum number of paragraphs that fit
        left, right = 0, len(paragraphs) - 1
        best_fit = -1
        best_sources = None
        best_output_tokens = 0

        while left <= right:
            mid = (left + right) // 2
            fits, limited_sources, available_output_tokens = check_paragraphs_fit(mid + 1)

            if fits:
                # This many paragraphs fit, try more
                best_fit = mid
                best_sources = limited_sources
                best_output_tokens = available_output_tokens
                left = mid + 1
                logger.debug("Binary search: %d paragraphs fit, trying more", mid + 1)
            else:
                # Too many paragraphs, try fewer
                right = mid - 1
                logger.debug("Binary search: %d paragraphs don't fit, trying fewer", mid + 1)

        count = 1 + best_fit
        if count > 0:
            if count < len(paragraphs):
                logger.warning("Reduced paragraphs to %d (from %d) due to limits",
                             count, len(paragraphs))
            return paragraphs[:count], best_sources, best_output_tokens

        # No paragraphs fit - calculate token breakdown for error message
        raise ValueError(
            f"Cannot fit any paragraphs within limits. "
            f"TPM limit: {tpm_limit}, Context window: {context_window}. "
            f"Try removing additional sources or increasing TPM limit."
        )

    def rebuild_remaining_texts(
        self,
        references_by_language: dict[str, list[str]],
        additional_sources_languages: list[str],
        remaining_additional_sources_texts: list[str]
    ) -> list[str]:
        """
        Updates remaining texts by removing the portions that were extracted as references.

        Args:
            references_by_language: Dict mapping language name to list of extracted reference texts
            additional_sources_languages: List of language codes
            remaining_additional_sources_texts: Current remaining texts

        Returns:
            Updated remaining texts with consumed portions removed
        """
        reduced_texts = []

        for lang_code, remaining_text in zip(additional_sources_languages, remaining_additional_sources_texts):
            lang_name = LANGUAGES.get(lang_code, lang_code)
            extracted_refs = references_by_language.get(lang_name, [])

            # Calculate consumed length: sum of all extracted reference lengths
            consumed_length = sum(len(ref) for ref in extracted_refs if ref)
            consumed_length = min(consumed_length, len(remaining_text))

            # Remove consumed portion from beginning
            reduced_texts.append(remaining_text[consumed_length:])

        return reduced_texts

    def translate_paragraphs(
        self,
        original_language: str,
        paragraphs: list[str],
        additional_sources_languages: list[str],
        additional_sources_texts: list[str],
        translate_language: str,
        task_prompt: str | None = None
    ) -> TranslationResult:
        """
        Translate paragraphs with optional reference sources.

        Handles large documents by batching paragraphs to fit within model context.

        Args:
            original_language: Language code of original text
            paragraphs: List of paragraphs to translate
            additional_sources_languages: List of language codes for reference sources
            additional_sources_texts: Full text of each reference source
            translate_language: Target language code
            task_prompt: Optional custom task prompt (Part 1). If not provided, default prompt is used.

        Returns:
            TranslationResult with translations, references, remaining texts, and properties
        """
        remaining_paragraphs = paragraphs.copy()
        remaining_additional_sources_texts = additional_sources_texts.copy() if additional_sources_texts else []

        all_translated_paragraphs: list[str] = []
        all_references_by_language: dict[str, list[str]] = {
            LANGUAGES[lang]: [] for lang in additional_sources_languages
        } if additional_sources_languages else {}

        batch_num = 0
        paragraph_offset = 0

        # Build task prompt once at the beginning (if not provided)
        if not task_prompt:
            task_prompt = get_task_prompt(
                original_language=original_language,
                additional_sources_languages=additional_sources_languages,
                translate_language=translate_language,
            )

        while remaining_paragraphs:
            batch_num += 1
            logger.info("Processing batch %d, %d paragraphs remaining", batch_num, len(remaining_paragraphs))

            # Determine how many paragraphs fit and limit additional sources proportionally
            paragraphs_to_translate, limited_additional_sources_texts, available_output_tokens = self.reduce_paragraphs_to_fit(
                task_prompt=task_prompt,
                paragraphs=remaining_paragraphs,
                additional_sources_texts=remaining_additional_sources_texts if remaining_additional_sources_texts else None
            )

            # Build input text (Part 2) for this batch
            input_text = format_input(
                original_language=original_language,
                original_paragraphs=paragraphs_to_translate,
                additional_sources_languages=additional_sources_languages,
                additional_sources_texts=limited_additional_sources_texts,
                translate_language=translate_language,
            )

            # Send batch for translation with dynamically calculated output token budget
            translated_batch = self.send_for_translation(
                task_prompt=task_prompt,
                input_text=input_text,
                max_output_tokens=available_output_tokens,
            )

            # Extract results from batch
            batch_references_by_language: dict[str, list[str]] = {
                LANGUAGES[lang]: [] for lang in additional_sources_languages
            } if additional_sources_languages else {}

            for para in translated_batch:
                all_translated_paragraphs.append(para["translation"])

                # Extract references
                references = para.get("references", {})
                for lang_name, ref_text in references.items():
                    if lang_name in batch_references_by_language:
                        batch_references_by_language[lang_name].append(ref_text)
                    if lang_name in all_references_by_language:
                        all_references_by_language[lang_name].append(ref_text)

            # Update remaining texts
            if additional_sources_languages and remaining_additional_sources_texts:
                remaining_additional_sources_texts = self.rebuild_remaining_texts(
                    references_by_language=batch_references_by_language,
                    additional_sources_languages=additional_sources_languages,
                    remaining_additional_sources_texts=remaining_additional_sources_texts,
                )

            # Move to next batch
            num_translated = len(paragraphs_to_translate)
            remaining_paragraphs = remaining_paragraphs[num_translated:]
            paragraph_offset += num_translated

            logger.debug("Batch %d: translated %d paragraphs, %d remaining",
                        batch_num, num_translated, len(remaining_paragraphs))

        properties = {
            "provider": self.options.provider.value,
            "model": self.options.model,
            "temperature": self.options.temperature,
        }

        logger.info("Translation completed: %d paragraphs in %d batches",
                   len(all_translated_paragraphs), batch_num)

        return TranslationResult(
            translated_paragraphs=all_translated_paragraphs,
            references_by_language=all_references_by_language,
            remaining_additional_sources_texts=remaining_additional_sources_texts,
            properties=properties,
        )
