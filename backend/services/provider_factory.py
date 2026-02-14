import os
import logging
from models import Provider, TranslationServiceOptions
from services.base_provider import BaseTranslationProvider
from services.openai_provider import OpenAIProvider
from services.claude_provider import ClaudeProvider

logger = logging.getLogger(__name__)


def create_translation_provider(provider: Provider, options: TranslationServiceOptions) -> BaseTranslationProvider:
    """
    Factory function to create appropriate provider instance.

    Args:
        provider: Provider enum value
        options: Translation service options including model, temperature, etc.

    Returns:
        BaseTranslationProvider instance (OpenAIProvider or ClaudeProvider)

    Raises:
        ValueError: If provider is unknown or API key is not configured
    """

    if provider == Provider.OPENAI or provider == Provider.SIMPLE_GPT_1:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY environment variable is not configured")
        logger.info(f"Creating OpenAI provider with model: {options.model}")
        return OpenAIProvider(api_key, options)

    elif provider == Provider.CLAUDE:
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY environment variable is not configured")
        logger.info(f"Creating Claude provider with model: {options.model}")
        return ClaudeProvider(api_key, options)

    elif provider == Provider.DEFAULT_DEV:
        # Return OpenAI provider for development mode
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY environment variable is not configured")
        logger.info(f"Creating OpenAI provider (dev mode) with model: {options.model}")
        return OpenAIProvider(api_key, options)

    else:
        raise ValueError(f"Unknown provider: {provider}")
