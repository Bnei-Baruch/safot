PROMPT_1 = """
    You are a professional translator. 
    Translate the following text from {source_language} into {target_language}. 
    Preserve the meaning and context exactly. 
    The input consists of multiple paragraphs, each separated by the delimiter: " ||| " (with spaces on both sides). 
    Your translation must preserve this exact structure — return the translated text with " ||| " in the exact same positions. 
    Do not provide any explanations or additional information. 
    Only return the translated text.
"""

PROMPT_2 = """
    You are a professional translator.
    Your task is to translate text from {source_language} to {target_language}.
    Guidelines:
    - Preserve the full meaning and structure of the original text.
    - Do not add, remove, or rephrase any content.
    - The input consists of multiple paragraphs separated by the delimiter: " ||| " (with spaces on both sides).
    - You must preserve this structure exactly in the output — keep the same number of segments and place " ||| " in the same positions.
    - Follow the style and terminology reflected in the examples.
    Here are example translations: {examples}
    Return only the translated text. Do not include any explanations, comments, or formatting.
"""

CUSTOM_PROMPTS = {
    "prompt_1": PROMPT_1,
    "prompt_2": PROMPT_2,
}

LANGUAGES = {
    "en": "English",
    "fr": "French",
    "he": "Hebrew",
    "ar": "Arabic",
    "es": "Spanish",
    "ru": "Russian",
}

def build_custom_prompt(custom_key: str, source_language: str, target_language: str):
    if not custom_key in CUSTOM_PROMPTS:
        raise HTTPException(status_code=400, detail="Unknown custom_key %s" % custom_key)
    return CUSTOM_PROMPTS[custom_key].format(
        source_language=LANGUAGES[source_language],
        target_language=LANGUAGES[target_language])
