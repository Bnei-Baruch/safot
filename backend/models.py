from datetime import datetime
from peewee import *
from playhouse.postgres_ext import ArrayField, JSONField
from pydantic import BaseModel
from enum import Enum
from db import db


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
    labels = ArrayField(CharField)
    language = CharField()
    type = CharField()  # Type of the source (e.g., book, chapter)
    order = IntegerField(null=True)
    parent_source_id = IntegerField(null=True)
    original_source_id = IntegerField(null=True)
    properties = JSONField()

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
            (('source_id', 'order'), True),  # Ensures unique order per source
        )


class Language(str, Enum):
    ENGLISH = "en"
    HEBREW = "he"
    SPANISH = "es"
    RUSSIAN = "ru"
    FRENCH = "fr"


class SegmentsFetchRequest(BaseModel):
    source_id: int
    original_source_id: int
    source_language: Language
    target_language: Language
