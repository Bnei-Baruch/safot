"""
Add sources_origins and segments_origins tables for tracking origin relationships.
"""
from datetime import datetime
import peewee as pw

db_proxy = pw.DatabaseProxy()

class _Base(pw.Model):
    class Meta:
        database = db_proxy

class SourcesOrigins(_Base):
    id = pw.IntegerField(sequence='sources_origins_id_seq')
    origin_source_id = pw.IntegerField()
    translated_source_id = pw.IntegerField()

    class Meta:
        database = db_proxy
        table_name = 'sources_origins'
        primary_key = pw.CompositeKey('id')
        indexes = (
            (('origin_source_id',), False),
            (('translated_source_id',), False),
        )


class SegmentsOrigins(_Base):
    id = pw.IntegerField(sequence='segments_origins_id_seq')
    origin_segment_id = pw.IntegerField()
    origin_segment_timestamp = pw.DateTimeField()
    translated_segment_id = pw.IntegerField()
    translated_segment_timestamp = pw.DateTimeField()

    class Meta:
        database = db_proxy
        table_name = 'segments_origins'
        primary_key = pw.CompositeKey('id')
        indexes = (
            (('origin_segment_id', 'origin_segment_timestamp'), False),
            (('translated_segment_id', 'translated_segment_timestamp'), False),
        )


def migrate(migrator, database, fake=False, **kwargs):
    db_proxy.initialize(database)
    
    # Create sources_origins table
    SourcesOrigins.create_table()
    
    # Create segments_origins table
    SegmentsOrigins.create_table()


def rollback(migrator, database, fake=False, **kwargs):
    db_proxy.initialize(database)
    
    # Drop tables in reverse order
    SegmentsOrigins.drop_table()
    SourcesOrigins.drop_table()

