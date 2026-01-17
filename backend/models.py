from datetime import datetime, timezone
import peewee as pw
from playhouse.postgres_ext import ArrayField, JSONField
from pydantic import BaseModel, validator
from enum import Enum
from db import db
from typing import List, TypedDict


class Sources(pw.Model):
    id = pw.IntegerField(sequence='source_id_seq')
    username = pw.CharField()
    created_at = pw.DateTimeField(default=lambda: datetime.now(timezone.utc))
    modified_by = pw.CharField()
    modified_at = pw.DateTimeField(default=lambda: datetime.now(timezone.utc))
    name = pw.CharField()
    language = pw.CharField()
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
    timestamp = pw.DateTimeField(default=lambda: datetime.now(timezone.utc))
    username = pw.CharField()
    text = pw.TextField()  # Text of the paragraph
    source_id = pw.IntegerField()
    order = pw.IntegerField()
    properties = JSONField()

    class Meta:
        database = db
        table_name = 'segments'
        primary_key = pw.CompositeKey('id', 'timestamp')
        indexes = (
            # Ensures unique order per source
            (('source_id', 'order', 'timestamp'), True),
        )


class SourcesOrigins(pw.Model):
    id = pw.IntegerField(sequence='sources_origins_id_seq')
    origin_source_id = pw.IntegerField()
    translated_source_id = pw.IntegerField()

    class Meta:
        database = db
        table_name = 'sources_origins'
        primary_key = pw.CompositeKey('id')
        indexes = (
            (('origin_source_id',), False),
            (('translated_source_id',), False),
            (('origin_source_id', 'translated_source_id'), True),  # Unique constraint
        )


class SegmentsOrigins(pw.Model):
    id = pw.IntegerField(sequence='segments_origins_id_seq')
    origin_segment_id = pw.IntegerField()
    origin_segment_timestamp = pw.DateTimeField()
    translated_segment_id = pw.IntegerField()
    translated_segment_timestamp = pw.DateTimeField()

    class Meta:
        database = db
        table_name = 'segments_origins'
        primary_key = pw.CompositeKey('id')
        indexes = (
            (('origin_segment_id', 'origin_segment_timestamp'), False),
            (('translated_segment_id', 'translated_segment_timestamp'), False),
            (('origin_segment_id', 'origin_segment_timestamp', 'translated_segment_id', 'translated_segment_timestamp'), True),  # Unique constraint
        )


class Dictionaries(pw.Model):
    id = pw.IntegerField(sequence='dictionary_id_seq')
    timestamp = pw.DateTimeField(default=lambda: datetime.now(timezone.utc))
    name = pw.CharField()
    username = pw.CharField()
    labels = ArrayField(pw.CharField, null=True)
    original_language = pw.CharField(null=True)
    additional_sources_languages = ArrayField(pw.CharField, null=True)
    translated_language = pw.CharField(null=True)

    class Meta:
        database = db
        table_name = 'dictionaries'
        primary_key = pw.CompositeKey('id', 'timestamp')


class Rules(pw.Model):
    id = pw.IntegerField(sequence='rule_id_seq')
    timestamp = pw.DateTimeField(default=lambda: datetime.now(timezone.utc))
    name = pw.CharField()
    username = pw.CharField()
    type = pw.CharField()
    dictionary_id = pw.IntegerField()
    properties = JSONField()
    order = pw.IntegerField(null=True)
    deleted = pw.BooleanField(default=False)

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
    original_language: str
    paragraphs: List[str]
    additional_sources_languages: List[str]
    additional_sources_texts: List[str]
    translate_language: str
    # Optional: custom task prompt (Part 1). If not provided, default prompt is used.
    task_prompt: str | None = None

class PromptRequest(BaseModel):
    dictionary_id: int | None = None
    # If timestamp not set will take latest version of that dictionary.
    dictionary_timestamp: int | None = None

    # Required when dictionary_id is not set (for default task prompt).
    original_language: str = ""
    additional_sources_languages: List[str] = []
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
