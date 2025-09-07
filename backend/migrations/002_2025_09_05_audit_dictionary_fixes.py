"""
- Adds audit columns, created_at, modified_by, modified_at to sources.
- Adds dictionary_id and dictionary_timestamp to source.
- Drops sourcedictionarylink. As no dictionary data exist yet, ignore backfill.
"""
from datetime import datetime
import peewee as pw
from playhouse.postgres_ext import JSONField, ArrayField

# Frozen snapshot of the old link table for rollback.
db_proxy = pw.DatabaseProxy()

class _Base(pw.Model):
    class Meta:
        database = db_proxy

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
        primary_key = pw.CompositeKey('source', 'dictionary_id', 'dictionary_timestamp')
        indexes = (
            # Index to efficiently query which sources used a specific dictionary snapshot
            (('dictionary_id', 'dictionary_timestamp'), False),
            # Index to efficiently query which dictionaries are linked to a specific source
            (('source_id',), False),
        )

def migrate(migrator, database, fake=False, **kwargs):
    # Add audit and dictionary reference to sources.
    migrator.add_columns(
		"source",
        created_at=pw.DateTimeField(default=datetime.utcnow),
        modified_by=pw.CharField(null=True),
        modified_at=pw.DateTimeField(default=datetime.utcnow),
		dictionary_id=pw.IntegerField(null=True),
    	dictionary_timestamp=pw.DateTimeField(null=True))

    # Drop the link table (empty/ignored per your note)
    migrator.remove_model("sourcedictionarylink")


def rollback(migrator, database, fake=False, **kwargs):
    # Recreate the link table using the frozen snapshot
    db_proxy.initialize(database)
    if not database.table_exists("sourcedictionarylink"):
        migrator.create_model(SourceDictionaryLink)

    # Remove new columns on source
    migrator.drop_columns("source",
		"dictionary_timestamp", "dictionary_id",
		"modified_at", "modified_by", "created_at")

