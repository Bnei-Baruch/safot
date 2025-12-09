from fastapi import HTTPException
from peewee import (
    JOIN,
    fn,
)
import textwrap
import logging
import re, string
from collections import ChainMap

from models import (
    Dictionaries,
    Rules,
)


# Move microseconds to shared library.
from services.utils import (
    microseconds,
)

logger = logging.getLogger(__name__)

RULE_TYPE_PROMPT_KEY="prompt_key"
RULE_TYPE_TEXT="text"
RULE_TYPE_SEGMENTS_SUFFIX="segments_suffix"

def clean(s: str) -> str:
    return textwrap.dedent(s).strip('\n')

PROMPT_1 = clean("""
    You are a professional translator. 
    Translate the following text from {original_language} into {translated_language}. 
    Preserve the meaning and context exactly. 
    Do not provide any explanations or additional information. 
    Only return the translated text. \n\n
""")

PROMPT_2 = clean("""
    You are a professional translator.
    Your task is to translate text from {original_language} to {translated_language}.
    Guidelines:
    - Preserve the full meaning and structure of the original text.
    - Do not add, remove, or rephrase any content.
    - Follow the style and terminology reflected in the examples.
    Here are example translations: {examples}
    Return only the translated text. Do not include any explanations, comments, or formatting. \n\n
""")

SEGMENTS_SUFFIX = clean("""
    Additional important guildelines:
    - The input consists of multiple paragraphs separated by the delimiter: " ||| " (with spaces on both sides).
    - You must preserve this structure exactly in the output - keep the same number of segments and place " ||| " in the same positions.
    - Output format: Return a JSON object containing a dictionary with the following structure:
      {
        "segments": {},
        "translation": "<segment_1> ||| <segment_2> ||| ..."
      }
    - The "translation" field contains a single string with translated segments separated by " ||| " (with spaces on both sides), matching the original source segments split, content-wise. Each segment corresponds to one segment from the original source.
    - The "segments" field should contain a dictionary mapping source languages to lists of segments (when reference sources are provided), or an empty dictionary if no reference sources are provided.
""")

MULTI_SOURCE_INSTRUCTIONS = clean("""
    Multi-source translation instructions:
    - Use the provided reference sources to guide your translation and maintain consistency.
    
    SEGMENTS SPLITTING - SIMPLE APPROACH:
    1. Look at the ORIGINAL source text (the input with " ||| " delimiters). Count how many segments it has.
    2. For EACH reference source text provided, split it into segments that align with the original source segments.
    3. For each original segment in order:
       a. Find the corresponding portion in the reference source text that matches that segment's content
       b. Extract that portion as a separate segment
       c. The segments should align content-wise with the original segments
    
    EXAMPLE:
    Original source: "Hello ||| world ||| test" (3 segments)
    Reference source: "Hola mundo prueba"
    
    Step-by-step splitting:
    - Original segment 1: "Hello" → matches "Hola" in reference → Segment 1: "Hola"
    - Original segment 2: "world" → matches "mundo" in reference → Segment 2: "mundo"
    - Original segment 3: "test" → matches "prueba" in reference → Segment 3: "prueba"
    
    OUTPUT FORMAT:
    "segments": {
                "<source_language_1>": ["segment1_text", "segment2_text", "segment3_text", ...],
                "<source_language_2>": ["segment1_text", "segment2_text", "segment3_text", ...],
                ...
                }
    
    CRITICAL REMINDERS:
    - Segments align with ORIGINAL segments, NOT your translation
    - The number of segments MUST equal the number of original segments
    - Each segment should correspond to one original segment in order
    - Extract the text portions that match each original segment's content
    - Copy each reference segment exactly as written, preserving punctuation and spacing
    - If no reference sources are provided, return an empty dictionary: "segments": {}
""")

SOURCES_CONTENT = "{language} : {text}"

def build_sources_placeholder(num_additional_sources: int = 0) -> str:
    """Build placeholder section for additional sources that can be filled in later.
    Uses SOURCES_CONTENT format as placeholders for each source.
    """
    sources_lines = []
    for i in range(num_additional_sources):
        sources_lines.append(SOURCES_CONTENT)
    return "\n\nReference sources:\n" + "\n".join(sources_lines)

CUSTOM_PROMPTS = {
    "prompt_1": PROMPT_1,
    "prompt_2": PROMPT_2,
}

ORIGINAL_LANGUAGE = "<Original Language>"
TRANSLATED_LANGUAGE = "<Translated Language>"

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

    # Special language to output template.
    ORIGINAL_LANGUAGE: ORIGINAL_LANGUAGE,
    TRANSLATED_LANGUAGE: TRANSLATED_LANGUAGE,
}

_prompt_params = re.compile(r"[A-Za-z_]\w*$")
def prompt_params(fmt: str) -> list[str]:
    """Return unique param names like {greeting}, ignoring {{escaped}} and complex fields."""
    names = []
    for _, field, _, _ in string.Formatter().parse(fmt):
        if field and _prompt_params.fullmatch(field):
            if field not in names:
                names.append(field)   # preserve order
    return names


def build_custom_prompt(prompt_key: str, original_language: str, translated_language: str, with_segments_suffix: bool = True, num_additional_sources: int = 0) -> str:
    if not prompt_key in CUSTOM_PROMPTS:
        raise HTTPException(status_code=400, detail="Unknown prompt_key %s" % prompt_key)
    defaults = {param: "<%s>" % param for param in prompt_params(CUSTOM_PROMPTS[prompt_key])}
    segments_suffix = SEGMENTS_SUFFIX if with_segments_suffix else ""
    prompt = CUSTOM_PROMPTS[prompt_key].format_map(ChainMap({
        "original_language": LANGUAGES[original_language],
        "translated_language": LANGUAGES[translated_language],
    }, defaults)) + segments_suffix
    
    if num_additional_sources > 0:
        prompt += "\n\n" + MULTI_SOURCE_INSTRUCTIONS
        prompt += build_sources_placeholder(num_additional_sources)
    
    return prompt

# TODO: There is duplication of this function and standard fetch_fules handler.
# Need to merge both of them.
def select_rules(d: Dictionaries) -> list[dict]:
    latest = Rules.select(
        Rules.id,
        fn.MAX(Rules.timestamp).alias("latest_timestamp"),
    ).where(
        (Rules.dictionary_id == d.id) &
        # Fetching rules not newer than dictionary is key to
        # fetch rules per for specific dictionary timestamp version.
        (Rules.timestamp <= d.timestamp)  
    ).group_by(Rules.id)
    q = Rules.select().join(latest, JOIN.INNER, on=(
        (Rules.id == latest.c.id) &
        (Rules.timestamp == latest.c.latest_timestamp)
    )).order_by(Rules.order)
    return list(q)

def rule_to_string(r: Rules) -> str:
    return "%d %d %s %s %s" % (r.id, r.timestamp.timestamp(), r.username, r.type, r.properties)

def rule_to_prompt(r: Rules) -> str:
    logger.info("RULE: %s", rule_to_string(r))
    if r.type == RULE_TYPE_PROMPT_KEY:
        ret = build_custom_prompt(r.properties["prompt_key"], ORIGINAL_LANGUAGE, TRANSLATED_LANGUAGE, False)
        logger.info("PROMPT KEY RULE PROMPT: %s", ret)
        return ret

    if r.type == RULE_TYPE_TEXT or r.type == RULE_TYPE_SEGMENTS_SUFFIX:
        ret = r.properties["text"]
        logger.info("TEXT RULE PROMPT: %s", ret)
        return ret

    raise Exception("%s rule type not implemented" % r.type)

def build_prompt(dictionary_id: int, dictionary_timestamp: int | None, num_additional_sources: int = 0) -> str | None:
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
        # TODO: Replace expections with library level when needed.
        raise HTTPException(status_code=404, detail="Not found")
    if len(dictionaries) > 1:
        raise HTTPException(status_code=500, detail="Multiple rows found")
    dictionary = dictionaries[0]
    logger.info("Dictionary: %s", dictionary)
    rules = select_rules(dictionary)
    rule_prompts = [rule_to_prompt(r) for r in rules]
    prompt = "\n".join(rule_prompts)
    
    if num_additional_sources > 0:
        prompt += "\n\n" + MULTI_SOURCE_INSTRUCTIONS
        prompt += build_sources_placeholder(num_additional_sources)
    
    return prompt
