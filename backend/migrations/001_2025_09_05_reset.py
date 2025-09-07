"""First migration, recreatess older database schema state."""
from datetime import datetime
import peewee as pw
from playhouse.postgres_ext import JSONField, ArrayField

# As we start with pre-existing database, we have to freeze peewee
# models to allow mutating latest models to use in production.
# Prom this point on, we should not use peewee Models for migration
# as this will not allow up to update them and use them in their
# latest version.
db_proxy = pw.DatabaseProxy()

class _Base(pw.Model):
    class Meta:
        database = db_proxy

class Dictionary(_Base):
    id = pw.IntegerField(sequence='dictionary_id_seq')
    timestamp = pw.DateTimeField(default=datetime.utcnow)
    name = pw.CharField()
    username = pw.CharField()
    labels = ArrayField(pw.CharField, null=True)

    class Meta:
        database = db_proxy
        primary_key = pw.CompositeKey('id', 'timestamp')


class Rule(_Base):
    id = pw.IntegerField(sequence='rule_id_seq')
    timestamp = pw.DateTimeField(default=datetime.utcnow())
    name = pw.CharField()
    username = pw.CharField()
    type = pw.CharField()
    dictionary_id = pw.IntegerField()
    dictionary_timestamp = pw.DateTimeField()
    properties = JSONField()

    class Meta:
        database = db_proxy
        primary_key = pw.CompositeKey('id', 'timestamp')
        indexes = (
            (('dictionary_id', 'dictionary_timestamp'), False),
        )

class Source(_Base):
    id = pw.IntegerField(sequence='source_id_seq')
    username = pw.CharField()
    name = pw.CharField()
    language = pw.CharField()
    original_source_id = pw.IntegerField(null=True)
    labels = ArrayField(pw.CharField, null=True)
    type = pw.CharField(null=True)  # Type of the source (e.g., book, chapter)
    order = pw.IntegerField(null=True)
    parent_source_id = pw.IntegerField(null=True)
    properties = JSONField(null=True)

    class Meta:
        database = db_proxy
        primary_key = pw.CompositeKey('id')

class SourceDictionaryLink(_Base):
    # Foreign key to Source with cascade delete
    source = pw.ForeignKeyField(Source, backref='dictionary_links', to_field='id', on_delete='CASCADE')
    # Can't be ForeignKeyField due to composite PK in Dictionary
    dictionary_id = pw.IntegerField()
    dictionary_timestamp = pw.DateTimeField()

    origin = pw.CharField()  # Options: 'self', 'reused', 'copied', 'imported'

    class Meta:
        database = db_proxy
        primary_key = pw.CompositeKey('source', 'dictionary_id', 'dictionary_timestamp')
        indexes = (
            # Index to efficiently query which sources used a specific dictionary snapshot
            (('dictionary_id', 'dictionary_timestamp'), False),
            # Index to efficiently query which dictionaries are linked to a specific source
            (('source_id',), False),
        )

class Segment(_Base):
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
        database = db_proxy
        table_name = 'segment'
        primary_key = pw.CompositeKey('id', 'timestamp')
        indexes = (
            # Ensures unique order per source
            (('source_id', 'order', 'timestamp'), True),
        )

def migrate(migrator, database, fake=False, **kwargs):
    db_proxy.initialize(database)
    migrator.create_model(Source)
    migrator.create_model(Segment)
    migrator.create_model(Dictionary)
    migrator.create_model(Rule)
    migrator.create_model(SourceDictionaryLink)


def rollback(migrator, database, fake=False, **kwargs):
    migrator.remove_model('sourcedictionarylink')
    migrator.remove_model('rule')
    migrator.remove_model('dictionary')
    migrator.remove_model('segment')
    migrator.remove_model('source')
