from fastapi import HTTPException
from peewee import (
    JOIN,
    fn,
)
import textwrap
import logging

from models import (
    Dictionaries,
)

from services.utils import (
    microseconds,
)
from services.dictionary import get_rules

logger = logging.getLogger(__name__)

# Rule types for dictionary-based prompts
RULE_TYPE_TEXT = "text"
RULE_TYPE_SEGMENTS_SUFFIX = "segments_suffix"

# Segments suffix for dictionary rules (used when building custom prompts from rules)
SEGMENTS_SUFFIX = "\n\nNow translate the following paragraphs:\n"

def clean(s: str) -> str:
    return textwrap.dedent(s).strip('\n')

# =============================================================================
# LANGUAGES
# =============================================================================

LANGUAGES = {
    "en": "English",
    "fr": "French",
    "he": "Hebrew",
    "ar": "Arabic",
    "es": "Spanish",
    "ru": "Russian",
    "uk": "Ukrainian",
    "tr": "Turkish",
    "de": "German",
    "it": "Italian",
}

def validate_language(lang_code: str) -> str:
    """Validate language code and return full language name."""
    if lang_code not in LANGUAGES:
        raise HTTPException(status_code=400, detail=f"Unknown language code: {lang_code}")
    return LANGUAGES[lang_code]

# =============================================================================
# DEFAULT TASK PROMPT
# =============================================================================

DEFAULT_TASK_PROMPT = clean("""
You are a professional translator.

TASK: Align and translate text from {original_language} to {translate_language}.
The <original_source> defines the master structure for the output.

INPUT FORMAT:
- <original_source language="...">: Contains numbered <p id="N"> paragraphs - this is your master structure
- <additional_sources>: Reference translations in other languages (may be empty)
- <translate_to_language>: Target language for translation

OUTPUT FORMAT - Return valid JSON only, no markdown:
{{
  "paragraphs": [
    {{
      "id": <number matching p id>,
      "original_paragraph": "<exact text from original source>",
      "references": {{
        {references_format}
      }},
      "translation": "<your translation to {translate_language}>"
    }}
  ]
}}

CONSTRAINTS:
1. FIXED LENGTH: Output exactly one object per <p> tag in <original_source>. Never omit any.
2. PRESERVE ORIGINAL: The "original_paragraph" field must exactly match the <p> content.
3. PRESERVE REFERENCES: Copy reference text exactly as written, preserving punctuation and spacing.
4. CONTEXTUAL MERGING: If reference text contains extra content belonging to a paragraph's context, include it in that paragraph's reference field.
5. EMPTY FIELDS: If a reference has no matching content for a paragraph, use empty string "".

{references_note}

EXAMPLE INPUT:
<original_source language="Hebrew">
    <p id="1">שלום</p>
    <p id="2">עולם</p>
    <p id="3">בדיקה</p>
</original_source>

<additional_sources>
    <text language="English">Hello world test</text>
    <text language="Spanish">Hola mundo prueba</text>
</additional_sources>

<translate_to_language>Arabic</translate_to_language>

EXAMPLE OUTPUT:
{{
  "paragraphs": [
    {{
      "id": 1,
      "original_paragraph": "שלום",
      "references": {{
        "English": "Hello",
        "Spanish": "Hola"
      }},
      "translation": "مرحبا"
    }},
    {{
      "id": 2,
      "original_paragraph": "עולם",
      "references": {{
        "English": "world",
        "Spanish": "mundo"
      }},
      "translation": "عالم"
    }},
    {{
      "id": 3,
      "original_paragraph": "בדיקה",
      "references": {{
        "English": "test",
        "Spanish": "prueba"
      }},
      "translation": "اختبار"
    }}
  ]
}}
""")

# =============================================================================
# PROMPT GENERATION FUNCTIONS
# =============================================================================

def get_task_prompt(
    original_language: str,
    additional_sources_languages: list[str],
    translate_language: str
) -> str:
    """
    Generate the task definition prompt (Part 1).

    Args:
        original_language: Language code for original source (e.g., "he")
        additional_sources_languages: List of language codes for references (e.g., ["en", "ru"])
        translate_language: Target language code (e.g., "ar")

    Returns:
        Task prompt with language names and expected output format
    """
    # Validate all languages
    original_lang_name = validate_language(original_language)
    translate_lang_name = validate_language(translate_language)

    reference_lang_names = []
    for lang_code in additional_sources_languages:
        reference_lang_names.append(validate_language(lang_code))

    # Build references format for JSON output
    if reference_lang_names:
        references_format = ",\n        ".join(
            f'"{lang}": "<aligned text or empty string>"'
            for lang in reference_lang_names
        )
        references_note = f"REFERENCE LANGUAGES: {', '.join(reference_lang_names)}\nEach paragraph must include these keys in 'references'."
    else:
        references_format = ""
        references_note = "Note: No reference sources provided. The 'references' object will be empty {}."

    return DEFAULT_TASK_PROMPT.format(
        original_language=original_lang_name,
        translate_language=translate_lang_name,
        references_format=references_format,
        references_note=references_note,
    )


def format_input(
    original_language: str,
    original_paragraphs: list[str],
    additional_sources_languages: list[str],
    additional_sources_texts: list[str],
    translate_language: str
) -> str:
    """
    Format the input for translation (Part 2).

    Args:
        original_language: Language code for original source
        original_paragraphs: List of paragraphs to translate
        additional_sources_languages: List of language codes for references
        additional_sources_texts: List of reference texts (full text, not split)
        translate_language: Target language code

    Returns:
        Formatted XML-like input string
    """
    # Validate languages
    original_lang_name = validate_language(original_language)
    translate_lang_name = validate_language(translate_language)

    # Build original source section
    paragraphs_xml = "\n".join(
        f'    <p id="{i+1}">{para}</p>'
        for i, para in enumerate(original_paragraphs)
    )
    original_section = f'<original_source language="{original_lang_name}">\n{paragraphs_xml}\n</original_source>'

    # Build additional sources section
    if additional_sources_languages and additional_sources_texts:
        sources_xml = "\n".join(
            f'    <text language="{validate_language(lang)}">{text}</text>'
            for lang, text in zip(additional_sources_languages, additional_sources_texts)
        )
        additional_section = f'<additional_sources>\n{sources_xml}\n</additional_sources>'
    else:
        additional_section = '<additional_sources></additional_sources>'

    # Build translate to section
    translate_section = f'<translate_to_language>{translate_lang_name}</translate_to_language>'

    return f"{original_section}\n\n{additional_section}\n\n{translate_section}"


def get_full_prompt(
    original_language: str,
    original_paragraphs: list[str],
    additional_sources_languages: list[str],
    additional_sources_texts: list[str],
    translate_language: str
) -> str:
    """
    Generate the complete prompt combining task definition and input.

    Args:
        original_language: Language code for original source
        original_paragraphs: List of paragraphs to translate
        additional_sources_languages: List of language codes for references
        additional_sources_texts: List of reference texts
        translate_language: Target language code

    Returns:
        Complete prompt ready to send to LLM
    """
    task_prompt = get_task_prompt(
        original_language=original_language,
        additional_sources_languages=additional_sources_languages,
        translate_language=translate_language,
    )

    input_text = format_input(
        original_language=original_language,
        original_paragraphs=original_paragraphs,
        additional_sources_languages=additional_sources_languages,
        additional_sources_texts=additional_sources_texts,
        translate_language=translate_language,
    )

    return f"{task_prompt}\n\n---\n\nINPUT:\n{input_text}"


# =============================================================================
# DICTIONARY/RULES SUPPORT (kept for custom prompts)
# =============================================================================

def rule_to_string(r: dict) -> str:
    """Convert rule to string for logging."""
    timestamp_epoch = r.get("timestamp_epoch", r.get("modified_at_epoch", 0)) / 1000000
    return "%d %d %s %s %s" % (r["id"], timestamp_epoch, r.get("modified_by", r.get("username", "")), r["type"], r["properties"])


def rule_to_prompt(r: dict) -> str:
    """Convert a rule to prompt text."""
    logger.info("RULE: %s", rule_to_string(r))

    # Both text and segments_suffix rules are treated as text
    if r["type"] in (RULE_TYPE_TEXT, RULE_TYPE_SEGMENTS_SUFFIX):
        ret = r["properties"]["text"]
        logger.info("TEXT RULE PROMPT: %s", ret)
        return ret

    raise Exception("%s rule type not implemented" % r["type"])


def build_prompt_from_dictionary(dictionary_id: int, dictionary_timestamp: int | None = None) -> str:
    """
    Build prompt from dictionary rules.
    Used when user has custom dictionary with edited rules.

    Args:
        dictionary_id: ID of the dictionary
        dictionary_timestamp: Optional specific timestamp version

    Returns:
        Combined prompt from all rules
    """
    if dictionary_timestamp is not None:
        q = Dictionaries.select().where(
            (Dictionaries.id == dictionary_id) &
            (microseconds(Dictionaries.timestamp) == dictionary_timestamp)
        )
    else:
        latest = (Dictionaries
            .select(Dictionaries.id, fn.MAX(Dictionaries.timestamp).alias("latest_timestamp"))
            .where(Dictionaries.id == dictionary_id)
            .group_by(Dictionaries.id))
        q = Dictionaries.select().join(latest, JOIN.INNER, on=(
            (Dictionaries.id == latest.c.id) &
            (Dictionaries.timestamp == latest.c.latest_timestamp)
        ))

    dictionaries = list(q)
    if len(dictionaries) == 0:
        raise HTTPException(status_code=404, detail="Dictionary not found")
    if len(dictionaries) > 1:
        raise HTTPException(status_code=500, detail="Multiple dictionaries found")

    dictionary = dictionaries[0]
    logger.info("Dictionary: %s", dictionary)

    # Get all rules for this dictionary
    rules = get_rules(dictionary_id=dictionary.id, dictionary_timestamp=dictionary_timestamp)
    # Filter deleted rules
    rules = [r for r in rules if not r.get("deleted", False)]

    if not rules:
        raise HTTPException(status_code=400, detail="Dictionary has no rules")

    rule_prompts = [rule_to_prompt(r) for r in rules]
    return "\n".join(rule_prompts)


def get_default_prompt_as_text(
    original_language: str,
    additional_sources_languages: list[str],
    translate_language: str
) -> str:
    """
    Get the default task prompt as text for creating dictionary rules.
    This allows users to see and edit the default prompt.

    Args:
        original_language: Language code for original source
        additional_sources_languages: List of language codes for references
        translate_language: Target language code

    Returns:
        Task prompt text that can be stored as a rule
    """
    return get_task_prompt(
        original_language=original_language,
        additional_sources_languages=additional_sources_languages,
        translate_language=translate_language,
    )
