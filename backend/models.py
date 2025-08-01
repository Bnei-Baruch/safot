from datetime import datetime
from peewee import *
from playhouse.postgres_ext import ArrayField, JSONField
from pydantic import BaseModel, validator
from enum import Enum
from db import db
from typing import List


class Dictionary(Model):
    id = IntegerField(sequence='dictionary_id_seq')
    timestamp = DateTimeField(default=datetime.utcnow())
    name = CharField()
    username = CharField()
    labels = ArrayField(CharField)

    class Meta:
        database = db
        primary_key = CompositeKey('id', 'timestamp')


class Rule(Model):
    id = IntegerField(sequence='rule_id_seq')
    timestamp = DateTimeField(default=datetime.utcnow())
    name = CharField()
    username = CharField()
    type = CharField()
    dictionary_id = IntegerField()
    dictionary_timestamp = DateTimeField()
    properties = JSONField()

    class Meta:
        database = db
        primary_key = CompositeKey('id', 'timestamp')
        indexes = (
            (('dictionary_id', 'dictionary_timestamp'), True),
        )


class Source(Model):
    id = IntegerField(sequence='source_id_seq')
    username = CharField()
    name = CharField()
    language = CharField()
    original_source_id = IntegerField(null=True)
    labels = ArrayField(CharField, null=True)
    type = CharField(null=True)  # Type of the source (e.g., book, chapter)
    order = IntegerField(null=True)
    parent_source_id = IntegerField(null=True)
    properties = JSONField(null=True)

    class Meta:
        database = db
        primary_key = CompositeKey('id')


class Segment(Model):
    id = IntegerField(sequence='segment_id_seq')
    timestamp = DateTimeField(default=datetime.utcnow)
    username = CharField()
    text = TextField()  # Text of the paragraph
    source_id = IntegerField()
    order = IntegerField()
    original_segment_id = IntegerField(null=True)
    original_segment_timestamp = DateTimeField(null=True)
    properties = JSONField()

    class Meta:
        database = db
        table_name = 'segment'
        primary_key = CompositeKey('id', 'timestamp')
        indexes = (
            # Ensures unique order per source
            (('source_id', 'order', 'timestamp'), True),
        )


class ParagraphsTranslateRequest(BaseModel):
    paragraphs: list[str]
    source_language: str
    target_language: str


class Provider(str, Enum):
    DEFAULT_DEV = "dev"
    SIMPLE_GPT_1 = "simple-gpt-1"
    OPENAI = "openai"


class TranslationServiceOptions(BaseModel):
    source_language: str
    target_language: str
    model: str = "gpt-4o"
    provider: Provider = Provider.OPENAI
    temperature: float = 0.2
    prompt_key: str = "prompt_1"
