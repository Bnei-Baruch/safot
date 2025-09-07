from datetime import datetime
import peewee as pw
from playhouse.postgres_ext import ArrayField, JSONField
from pydantic import BaseModel, validator
from enum import Enum
from db import db
from typing import List, TypedDict


class Sources(pw.Model):
    id = pw.IntegerField(sequence='source_id_seq')
    username = pw.CharField()
    created_at = pw.DateTimeField(default=datetime.utcnow)
    modified_by = pw.CharField()
    modified_at = pw.DateTimeField(default=datetime.utcnow)
    name = pw.CharField()
    language = pw.CharField()
    original_source_id = pw.IntegerField(null=True)
    labels = ArrayField(pw.CharField, null=True)
    type = pw.CharField(null=True)  # Type of the source (e.g., book, chapter)
    order = pw.IntegerField(null=True)
    parent_source_id = pw.IntegerField(null=True)
    properties = JSONField(null=True)
    dictionary_id = pw.IntegerField(null=True)
    dictionary_timestamp = pw.DateTimeField(null=True)

    class Meta:
        database = db
        table_name = 'sources'
        primary_key = pw.CompositeKey('id')


class Segments(pw.Model):
    id = pw.IntegerField(sequence='segment_id_seq')
    timestamp = pw.DateTimeField(default=datetime.utcnow)
    username = pw.CharField()
    text = pw.TextField()  # Text of the paragraph
    source_id = pw.IntegerField()
    order = pw.IntegerField()
    original_segment_id = pw.IntegerField(null=True)
    original_segment_timestamp = pw.DateTimeField(null=True)
    properties = JSONField()

    class Meta:
        database = db
        table_name = 'segments'
        primary_key = pw.CompositeKey('id', 'timestamp')
        indexes = (
            # Ensures unique order per source
            (('source_id', 'order', 'timestamp'), True),
        )


class Dictionaries(pw.Model):
    id = pw.IntegerField(sequence='dictionary_id_seq')
    timestamp = pw.DateTimeField(default=datetime.utcnow)
    name = pw.CharField()
    username = pw.CharField()
    labels = ArrayField(pw.CharField, null=True)

    class Meta:
        database = db
        table_name = 'dictionaries'
        primary_key = pw.CompositeKey('id', 'timestamp')


class Rules(pw.Model):
    id = pw.IntegerField(sequence='rule_id_seq')
    timestamp = pw.DateTimeField(default=datetime.utcnow())
    name = pw.CharField()
    username = pw.CharField()
    type = pw.CharField()
    dictionary_id = pw.IntegerField()
    properties = JSONField()
    order = pw.IntegerField(null=True)

    class Meta:
        database = db
        table_name = 'rules'
        primary_key = pw.CompositeKey('id', 'timestamp')
        indexes = (
            (('dictionary_id',), False),
        )


# Server/HTTP API level definitions (not including database objects)
# BaseModels used to define some requests responses which
# are not regular Models - simple dicts are used for Models.
class Provider(str, Enum):
    DEFAULT_DEV = "dev"
    SIMPLE_GPT_1 = "simple-gpt-1"
    OPENAI = "openai"

class TranslationServiceOptions(BaseModel):
    model: str = "gpt-4o"
    # model: str = "gpt-3.5-turbo"
    provider: Provider = Provider.OPENAI
    temperature: float = 0.2

class ParagraphsTranslateRequest(BaseModel):
    paragraphs: List[str]
    prompt_text: str

class PromptRequest(BaseModel):
    dictionary_id: int | None = None
    # If timestamp not set will take latest version of that dictionary.
    dictionary_timestamp: int | None = None

    # Eigher dictionary_id or prompt_key should be set, not both.
    prompt_key: str = ""

    # Extra params for custom_key.
    original_language: str = ""
    translated_language: str = ""

class TranslationExample(TypedDict):
    sourceText: str
    firstTranslation: str
    lastTranslation: str

"""
class Example(BaseModel):
    sourceText: str
    firstTranslation: str
    lastTranslation: str

"""
