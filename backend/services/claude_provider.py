import tiktoken
import logging
import anthropic
from anthropic import Anthropic
from datetime import datetime
import re
import json

from models import TranslationServiceOptions
from services.base_provider import BaseTranslationProvider, TranslatedParagraph, OTHER_LANG_TEXT_MULTIPLIER

logger = logging.getLogger(__name__)

# Claude provider metadata
PROVIDER_NAME = "claude"
PROVIDER_LABEL = "Claude"

# Available models with their specifications
# List obtained from: curl https://api.anthropic.com/v1/models
# Pricing is approximate as of 2025-2026 (per MTok)
CLAUDE_MODELS = [
    {
        "value": "claude-sonnet-4-5-20250929",
        "label": "Claude Sonnet 4.5",
        "context_window": 200000,
        "max_output_tokens": 16384,
        "input_price": 3.0,   # $3/MTok
        "output_price": 15.0,  # $15/MTok
        "description": "Balanced performance and cost"
    },
    {
        "value": "claude-opus-4-6",
        "label": "Claude Opus 4.6 (Latest)",
        "context_window": 200000,
        "max_output_tokens": 16384,
        "input_price": 15.0,   # $15/MTok
        "output_price": 75.0,  # $75/MTok
        "description": "Most capable, highest cost"
    },
    {
        "value": "claude-opus-4-5-20251101",
        "label": "Claude Opus 4.5",
        "context_window": 200000,
        "max_output_tokens": 16384,
        "input_price": 15.0,
        "output_price": 75.0,
        "description": "High capability, premium pricing"
    },
    {
        "value": "claude-haiku-4-5-20251001",
        "label": "Claude Haiku 4.5",
        "context_window": 200000,
        "max_output_tokens": 8192,
        "input_price": 1.0,    # $1/MTok
        "output_price": 5.0,   # $5/MTok
        "description": "Fast and cost-effective"
    },
    {
        "value": "claude-opus-4-1-20250805",
        "label": "Claude Opus 4.1",
        "context_window": 200000,
        "max_output_tokens": 16384,
        "input_price": 15.0,
        "output_price": 75.0,
        "description": "Previous Opus version"
    },
    {
        "value": "claude-opus-4-20250514",
        "label": "Claude Opus 4",
        "context_window": 200000,
        "max_output_tokens": 16384,
        "input_price": 15.0,
        "output_price": 75.0,
        "description": "Original Opus 4"
    },
    {
        "value": "claude-sonnet-4-20250514",
        "label": "Claude Sonnet 4",
        "context_window": 200000,
        "max_output_tokens": 16384,
        "input_price": 3.0,
        "output_price": 15.0,
        "description": "Original Sonnet 4"
    },
    {
        "value": "claude-3-5-haiku-20241022",
        "label": "Claude Haiku 3.5",
        "context_window": 200000,
        "max_output_tokens": 8192,
        "input_price": 1.0,
        "output_price": 5.0,
        "description": "Budget-friendly option"
    },
    {
        "value": "claude-3-haiku-20240307",
        "label": "Claude Haiku 3",
        "context_window": 200000,
        "max_output_tokens": 4096,
        "input_price": 0.8,    # $0.8/MTok
        "output_price": 4.0,   # $4/MTok
        "description": "Lowest cost option"
    },
]


class ClaudeProvider(BaseTranslationProvider):
    """Anthropic Claude translation provider"""

    def __init__(self, api_key: str, options: TranslationServiceOptions):
        super().__init__(api_key, options)
        self.client = Anthropic(api_key=api_key)
        # Use tiktoken as approximation for Claude token counting (MVP approach)
        # Claude uses similar tokenization to OpenAI
        self.encoding = tiktoken.get_encoding("cl100k_base")

    def get_model_token_limit(self) -> dict:
        """Return context window and max output tokens for Claude models"""
        # Find model in CLAUDE_MODELS
        for model in CLAUDE_MODELS:
            if model["value"] == self.options.model:
                return {
                    "context_window": model["context_window"],
                    "max_output_tokens": model["max_output_tokens"]
                }
        # Default to Claude Sonnet 4.5 limits
        return {"context_window": 200000, "max_output_tokens": 16384}

    def calculate_input_tokens(
        self,
        task_prompt: str,
        original_paragraphs: list[str],
        additional_sources_texts: list[str] | None = None
    ) -> int:
        """
        Calculate approximate token count for the input.
        Uses tiktoken approximation (close enough for MVP).
        """
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
        # Use same approach as OpenAI for consistency
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
        Send paragraphs to Claude for translation.

        Args:
            task_prompt: Task prompt (Part 1) - system message
            input_text: Input text (Part 2) - user message
            max_output_tokens: Maximum tokens to allocate for output

        Returns:
            List of TranslatedParagraph objects from LLM response
        """

        logger.debug("Sending translation request to Claude")
        logger.debug("Task prompt:\n%s", task_prompt)
        logger.debug("Input:\n%s", input_text)

        try:
            start_time = datetime.utcnow()

            response = self.client.messages.create(
                model=self.options.model,
                max_tokens=max_output_tokens,
                temperature=self.options.temperature,
                system=task_prompt,  # Claude uses separate system parameter
                messages=[
                    {"role": "user", "content": input_text}
                ]
            )

            duration = (datetime.utcnow() - start_time).total_seconds()
            logger.debug("API call duration: %.2f seconds", duration)

            # Log token usage
            logger.info(f"Claude token usage: input={response.usage.input_tokens}, "
                       f"output={response.usage.output_tokens}, "
                       f"max_tokens_requested={max_output_tokens}")

            if not response.content or len(response.content) == 0:
                logger.error("Claude returned empty response")
                raise ValueError("Claude returned empty response")

            # Check stop_reason for truncation
            if response.stop_reason == "max_tokens":
                error_msg = (
                    f"Translation response was truncated due to max_tokens limit. "
                    f"Input tokens: {response.usage.input_tokens}, "
                    f"Output tokens: {response.usage.output_tokens}/{max_output_tokens}. "
                    f"Try translating fewer paragraphs at a time."
                )
                logger.error(error_msg)
                raise ValueError(error_msg)

            # Extract text from response
            text = response.content[0].text.strip()
            logger.debug("Raw response:\n%s", text)

            # Parse JSON (same format as OpenAI)
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

        except anthropic.APITimeoutError:
            logger.error("Request to Claude timed out")
            raise ValueError("Translation request timed out")

        except anthropic.NotFoundError as e:
            logger.error("Claude model not found: %s", str(e))
            raise ValueError(f"Model not found: {self.options.model}. Please select a valid Claude model.")

        except anthropic.APIError as e:
            logger.error("Claude API error: %s", str(e))
            raise ValueError(f"Claude API error: {e}")
