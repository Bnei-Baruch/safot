import tiktoken
import logging
from openai import OpenAI
from openai import OpenAIError, APITimeoutError
from datetime import datetime
import re
import json

from models import TranslationServiceOptions
from services.base_provider import BaseTranslationProvider, TranslatedParagraph, OTHER_LANG_TEXT_MULTIPLIER

logger = logging.getLogger(__name__)

# OpenAI provider metadata
PROVIDER_NAME = "openai"
PROVIDER_LABEL = "OpenAI"

# Available models with their specifications
# Pricing as of 2025-2026 (per MTok)
OPENAI_MODELS = [
    {
        "value": "gpt-4o",
        "label": "GPT-4o",
        "context_window": 128000,
        "max_output_tokens": 16384,
        "input_price": 2.5,    # $2.50/MTok
        "output_price": 10.0,  # $10/MTok
        "description": "Fast and capable, cost-effective"
    },
    {
        "value": "gpt-4-turbo",
        "label": "GPT-4 Turbo",
        "context_window": 128000,
        "max_output_tokens": 4096,
        "input_price": 10.0,   # $10/MTok
        "output_price": 30.0,  # $30/MTok
        "description": "High capability, higher cost"
    },
    {
        "value": "gpt-4",
        "label": "GPT-4",
        "context_window": 8192,
        "max_output_tokens": 2048,
        "input_price": 30.0,   # $30/MTok
        "output_price": 60.0,  # $60/MTok
        "description": "Legacy GPT-4, expensive"
    },
    {
        "value": "gpt-3.5-turbo",
        "label": "GPT-3.5 Turbo",
        "context_window": 16385,
        "max_output_tokens": 4096,
        "input_price": 0.5,    # $0.50/MTok
        "output_price": 1.5,   # $1.50/MTok
        "description": "Most cost-effective"
    },
]


class OpenAIProvider(BaseTranslationProvider):
    """OpenAI translation provider using GPT models"""

    def __init__(self, api_key: str, options: TranslationServiceOptions):
        super().__init__(api_key, options)
        self.client = OpenAI(api_key=api_key)
        self.encoding = tiktoken.encoding_for_model(self.options.model)

    def get_model_token_limit(self) -> dict:
        """Return context window and max output tokens for OpenAI models"""
        # Find model in OPENAI_MODELS
        for model in OPENAI_MODELS:
            if model["value"] == self.options.model:
                return {
                    "context_window": model["context_window"],
                    "max_output_tokens": model["max_output_tokens"]
                }
        # Default to gpt-4o limits
        return {"context_window": 128000, "max_output_tokens": 16384}

    def calculate_input_tokens(
        self,
        task_prompt: str,
        original_paragraphs: list[str],
        additional_sources_texts: list[str] | None = None
    ) -> int:
        """Calculate approximate token count for the input using tiktoken"""
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
        """Estimate output tokens based on input size"""
        # Output includes: original text (1x) + translation (OTHER_LANG_TEXT_MULTIPLIER)
        # + references from each source (num_references * OTHER_LANG_TEXT_MULTIPLIER)
        base_estimate = sum(len(self.encoding.encode(p)) for p in original_paragraphs)
        multiplier = 1 + OTHER_LANG_TEXT_MULTIPLIER + (num_references * OTHER_LANG_TEXT_MULTIPLIER)
        return int(base_estimate * multiplier)

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
