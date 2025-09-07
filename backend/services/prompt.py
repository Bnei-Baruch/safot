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
    Only return the translated text.
""")

PROMPT_2 = clean("""
    You are a professional translator.
    Your task is to translate text from {original_language} to {translated_language}.
    Guidelines:
    - Preserve the full meaning and structure of the original text.
    - Do not add, remove, or rephrase any content.
    - Follow the style and terminology reflected in the examples.
    Here are example translations: {examples}
    Return only the translated text. Do not include any explanations, comments, or formatting.
""")

SEGMENTS_SUFFIX = clean("""
    Additional important guildelines:
    - The input consists of multiple paragraphs separated by the delimiter: " ||| " (with spaces on both sides).
    - You must preserve this structure exactly in the output - keep the same number of segments and place " ||| " in the same positions.
""")

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


def build_custom_prompt(prompt_key: str, original_language: str, translated_language: str, with_segments_suffix: bool = True) -> str:
    if not prompt_key in CUSTOM_PROMPTS:
        raise HTTPException(status_code=400, detail="Unknown prompt_key %s" % prompt_key)
    defaults = {param: "<%s>" % param for param in prompt_params(CUSTOM_PROMPTS[prompt_key])}
    segments_suffix = SEGMENTS_SUFFIX if with_segments_suffix else ""
    return CUSTOM_PROMPTS[prompt_key].format_map(ChainMap({
        "original_language": LANGUAGES[original_language],
        "translated_language": LANGUAGES[translated_language],
    }, defaults)) + segments_suffix

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

def build_prompt(dictionary_id: int, dictionary_timestamp: int | None) -> str | None:
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
    return "\n".join(rule_prompts)
