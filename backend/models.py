from datetime import datetime
import logging
import os

from dotenv import load_dotenv
from peewee import *
from playhouse.postgres_ext import ArrayField, JSONField
from pydantic import BaseModel

load_dotenv()

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger('peewee')
logger.setLevel(logging.DEBUG)

db: float = PostgresqlDatabase(
    os.getenv('PG_DATABASE'),
    user=os.getenv('PG_USER'),
    password=os.getenv('PG_PASSWORD'),
    host=os.getenv('PG_HOST'),
    port=os.getenv('PG_PORT'))


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


db.connect()
db.create_tables([Source, Segment])
