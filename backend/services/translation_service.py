import threading
import tiktoken
import logging
from openai import OpenAI
from openai import OpenAIError, APITimeoutError
from datetime import datetime
from models import TranslationServiceOptions
from services.prompt import get_task_prompt, format_input, LANGUAGES
from typing import List, TypedDict
import re
import json

# Global locks per provider to prevent concurrent translations that would exceed TPM limits
_provider_locks = {}
_locks_lock = threading.Lock()

def get_provider_lock(provider: str) -> threading.Lock:
    """Get or create a lock for the given provider (thread-safe)"""
    with _locks_lock:
        if provider not in _provider_locks:
            _provider_locks[provider] = threading.Lock()
        return _provider_locks[provider]

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


class TranslationService:
    def __init__(self, api_key: str, options: TranslationServiceOptions):
        self.client = OpenAI(api_key=api_key)
        self.options = options
        self.encoding = tiktoken.encoding_for_model(self.options.model)

    def get_model_token_limit(self) -> dict:
        model_token_limits = {
            "gpt-4o": {"context_window": 128000, "max_output_tokens": 16384},
            "gpt-4": {"context_window": 8192, "max_output_tokens": 2048},
            "gpt-3.5-turbo": {"context_window": 4096, "max_output_tokens": 1024},
        }
        return model_token_limits.get(self.options.model, {"context_window": 128000, "max_output_tokens": 16384})

    def calculate_input_tokens(
        self,
        task_prompt: str,
        original_paragraphs: list[str],
        additional_sources_texts: list[str] | None = None
    ) -> int:
        """Calculate approximate token count for the input."""
        # Task prompt tokens
        prompt_tokens = len(self.encoding.encode(task_prompt))

        # Original paragraphs tokens (estimate with XML overhead)
        paragraphs_text = "\n".join(f'<p id="{i}">{p}</p>' for i, p in enumerate(original_paragraphs))
        paragraphs_tokens = len(self.encoding.encode(paragraphs_text))

        # Additional sources tokens
        sources_tokens = 0
        if additional_sources_texts:
            for text in additional_sources_texts:
                sources_tokens += len(self.encoding.encode(text))

        return prompt_tokens + paragraphs_tokens + sources_tokens

    def estimate_output_tokens(self, original_paragraphs: list[str], num_references: int) -> int:
        """Estimate output tokens based on input size."""
        # Output includes: original text (1x) + translation (OTHER_LANG_TEXT_MULTIPLIER)
        # + references from each source (num_references * OTHER_LANG_TEXT_MULTIPLIER)
        base_estimate = sum(len(self.encoding.encode(p)) for p in original_paragraphs)
        multiplier = 1 + OTHER_LANG_TEXT_MULTIPLIER + (num_references * OTHER_LANG_TEXT_MULTIPLIER)
        return int(base_estimate * multiplier)

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
            if limited_sources:
                source_tokens = [len(self.encoding.encode(s)) for s in limited_sources]
                logger.debug(f"  Limited sources to: {source_tokens} tokens ({[len(s) for s in limited_sources]} chars)")

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
        prompt_tokens = len(self.encoding.encode(task_prompt))
        sources_tokens = sum(len(self.encoding.encode(t)) for t in (additional_sources_texts or []))
        raise ValueError(
            f"Cannot fit any paragraphs within limits. "
            f"Prompt: {prompt_tokens} tokens, Additional sources: {sources_tokens} tokens, "
            f"TPM limit: {tpm_limit}, Context window: {context_window}. "
            f"Try removing additional sources or increasing TPM limit in OpenAI dashboard."
        )

    def send_for_translation(
        self,
        task_prompt: str,
        input_text: str,
        max_output_tokens: int,
    ) -> list[TranslatedParagraph]:
        """
        Send paragraphs to OpenAI for translation.

        Args:
            task_prompt: Task prompt (Part 1) - system message
            input_text: Input text (Part 2) - user message
            max_output_tokens: Maximum tokens to allocate for output

        Returns:
            List of TranslatedParagraph objects from LLM response
        """

        messages = [
            {"role": "system", "content": task_prompt},
            {"role": "user", "content": input_text}
        ]

        logger.debug("Sending translation request to OpenAI")
        logger.debug("Task prompt:\n%s", task_prompt)
        logger.debug("Input:\n%s", input_text)

        try:
            start_time = datetime.utcnow()
            response = self.client.chat.completions.create(
                model=self.options.model,
                messages=messages,
                max_tokens=max_output_tokens,
                temperature=self.options.temperature,
                timeout=600,
                response_format={"type": "json_object"}
            )
            duration = (datetime.utcnow() - start_time).total_seconds()
            logger.debug("API call duration: %.2f seconds", duration)

            # Log actual token usage
            if response.usage:
                logger.info(f"OpenAI token usage: input={response.usage.prompt_tokens}, "
                          f"output={response.usage.completion_tokens}, "
                          f"total={response.usage.total_tokens}, "
                          f"max_tokens_requested={max_output_tokens}")

            if not response or not response.choices or not response.choices[0].message.content:
                logger.error("OpenAI returned an empty response")
                raise ValueError("OpenAI returned an empty response")

            # Check if response was truncated due to max_tokens limit
            finish_reason = response.choices[0].finish_reason
            if finish_reason == "length":
                actual_input = response.usage.prompt_tokens if response.usage else "unknown"
                actual_output = response.usage.completion_tokens if response.usage else "unknown"
                actual_total = response.usage.total_tokens if response.usage else "unknown"

                error_msg = (
                    f"Translation response was truncated due to max_tokens limit. "
                    f"Input tokens: {actual_input}, "
                    f"Output tokens: {actual_output}/{max_output_tokens}, "
                    f"Total tokens: {actual_total}. "
                    f"Try translating fewer paragraphs at a time."
                )

                logger.error(error_msg)
                raise ValueError(error_msg)

            text = response.choices[0].message.content.strip()
            logger.debug("Raw response:\n%s", text)

            # Extract JSON from markdown code blocks if present
            json_text = re.sub(r'```(?:json)?\s*', '', text).replace('```', '').strip()

            try:
                response_json = json.loads(json_text)
            except json.JSONDecodeError as e:
                logger.error("Failed to parse JSON response: %s", e)
                logger.error("Response text: %s", json_text[:500])
                raise ValueError(f"Failed to parse JSON response: {e}")

            paragraphs = response_json.get("paragraphs", [])
            if not paragraphs:
                logger.error("No paragraphs in response")
                raise ValueError("No paragraphs in response")

            # Validate response structure
            for i, para in enumerate(paragraphs):
                if "id" not in para:
                    raise ValueError(f"Missing 'id' in paragraph {i}")
                if "translation" not in para:
                    raise ValueError(f"Missing 'translation' in paragraph {i}")

            return paragraphs

        except APITimeoutError:
            logger.error("Request to OpenAI timed out")
            raise ValueError("Translation request timed out")

        except OpenAIError as e:
            logger.error("OpenAI API error: %s", str(e))
            raise ValueError(f"OpenAI API error: {e}")

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
