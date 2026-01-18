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

logger = logging.getLogger(__name__)

# Constant for calculating additional sources text length relative to original text
ADDITIONAL_SOURCES_TEXT_LENGTH_MULTIPLIER = 1.5


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
        # Rough estimate: each paragraph produces ~2x tokens in output (original + translation + references)
        base_estimate = sum(len(self.encoding.encode(p)) for p in original_paragraphs)
        multiplier = 2 + (num_references * 0.5)  # More references = more output
        return int(base_estimate * multiplier)

    def reduce_paragraphs_to_fit(
        self,
        task_prompt: str,
        paragraphs: list[str],
        additional_sources_texts: list[str] | None = None
    ) -> tuple[list[str], int]:
        """
        Reduces paragraphs until they fit within the model's context window.

        Returns:
            Tuple of (paragraphs that fit, max tokens available for output)
        """
        paragraphs_to_translate = paragraphs.copy()
        model_limits = self.get_model_token_limit()
        context_window = model_limits["context_window"]
        max_output_tokens = model_limits["max_output_tokens"]

        while paragraphs_to_translate:
            input_tokens = self.calculate_input_tokens(
                task_prompt, paragraphs_to_translate, additional_sources_texts
            )
            estimated_output = self.estimate_output_tokens(
                paragraphs_to_translate,
                len(additional_sources_texts) if additional_sources_texts else 0
            )

            # Check if we fit within context window
            total_tokens = input_tokens + min(estimated_output, max_output_tokens)
            if total_tokens < context_window * 0.9:  # 90% safety margin
                available_output_tokens = min(max_output_tokens, context_window - input_tokens)
                return paragraphs_to_translate, available_output_tokens

            # Remove last paragraph and try again
            paragraphs_to_translate = paragraphs_to_translate[:-1]
            if paragraphs_to_translate:
                logger.warning("Reduced paragraphs to %d due to token limits", len(paragraphs_to_translate))

        raise ValueError("Cannot fit any paragraphs within model context window.")

    def send_for_translation(
        self,
        task_prompt: str,
        input_text: str,
    ) -> list[TranslatedParagraph]:
        """
        Send paragraphs to OpenAI for translation.

        Args:
            task_prompt: Task prompt (Part 1) - system message
            input_text: Input text (Part 2) - user message

        Returns:
            List of TranslatedParagraph objects from LLM response
        """
        model_limits = self.get_model_token_limit()
        max_output_tokens = min(model_limits["max_output_tokens"], 16000)

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

            if not response or not response.choices or not response.choices[0].message.content:
                logger.error("OpenAI returned an empty response")
                raise ValueError("OpenAI returned an empty response")

            # Check if response was truncated due to max_tokens limit
            finish_reason = response.choices[0].finish_reason
            if finish_reason == "length":
                logger.error("Response was truncated due to max_tokens limit")
                raise ValueError("Translation response was truncated. Try translating fewer paragraphs at a time.")

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

            # Determine how many paragraphs fit in this batch. This does NOT
            # require exact input_text as it estimated additional sources by
            # multiplying the original paragraphs by a constant.
            paragraphs_to_translate, _ = self.reduce_paragraphs_to_fit(
                task_prompt=task_prompt,
                paragraphs=remaining_paragraphs,
                additional_sources_texts=remaining_additional_sources_texts if remaining_additional_sources_texts else None
            )

            # Build input text (Part 2) for this batch
            input_text = format_input(
                original_language=original_language,
                original_paragraphs=paragraphs_to_translate,
                additional_sources_languages=additional_sources_languages,
                additional_sources_texts=remaining_additional_sources_texts,
                translate_language=translate_language,
            )

            # Send batch for translation
            translated_batch = self.send_for_translation(
                task_prompt=task_prompt,
                input_text=input_text,
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
