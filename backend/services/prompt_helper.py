"""
Helper functions for fetching task prompts from various sources.

Centralizes prompt fetching logic used by multiple endpoints.
"""
from services.prompt import build_prompt_from_dictionary, get_task_prompt


def get_task_prompt_for_translation(
    custom_prompt: str | None,
    dictionary_id: int | None,
    dictionary_timestamp: int | None,
    original_language: str,
    additional_sources_languages: list[str],
    translate_language: str
) -> str:
    """
    Get task prompt from custom input, dictionary, or default template.

    Centralized logic used by both /translate and /estimate-cost endpoints.

    Priority order:
    1. Custom prompt (if provided)
    2. Dictionary prompt (if dictionary_id provided)
    3. Default prompt template (based on languages)

    Args:
        custom_prompt: Optional custom task prompt text
        dictionary_id: Optional dictionary ID to fetch prompt from
        dictionary_timestamp: Optional timestamp for specific dictionary version
        original_language: Source language code
        additional_sources_languages: List of additional reference language codes
        translate_language: Target language code

    Returns:
        Task prompt string (Part 1 of translation request)
    """
    # Priority 1: Custom prompt
    if custom_prompt:
        return custom_prompt

    # Priority 2: Dictionary prompt
    if dictionary_id:
        return build_prompt_from_dictionary(
            dictionary_id=dictionary_id,
            dictionary_timestamp=dictionary_timestamp
        )

    # Priority 3: Default prompt based on languages
    return get_task_prompt(
        original_language=original_language,
        additional_sources_languages=additional_sources_languages,
        translate_language=translate_language
    )
