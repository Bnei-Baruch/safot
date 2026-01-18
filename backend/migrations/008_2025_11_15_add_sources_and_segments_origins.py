"""
Add sources_origins and segments_origins tables for tracking origin relationships.
Migrate existing data from old columns and remove deprecated columns.
"""
import peewee as pw

db_proxy = pw.DatabaseProxy()

class SourcesOrigins(pw.Model):
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
            (('origin_source_id', 'translated_source_id'), True),  # Unique constraint
        )


class SegmentsOrigins(pw.Model):
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
    database.execute_sql("""
        CREATE TABLE IF NOT EXISTS sources_origins (
            id SERIAL PRIMARY KEY,
            origin_source_id INTEGER NOT NULL,
            translated_source_id INTEGER NOT NULL,
            UNIQUE (origin_source_id, translated_source_id)
        );
    """)
    database.execute_sql("CREATE INDEX IF NOT EXISTS sources_origins_origin_source_id ON sources_origins (origin_source_id);")
    database.execute_sql("CREATE INDEX IF NOT EXISTS sources_origins_translated_source_id ON sources_origins (translated_source_id);")

    # Create segments_origins table
    database.execute_sql("""
        CREATE TABLE IF NOT EXISTS segments_origins (
            id SERIAL PRIMARY KEY,
            origin_segment_id INTEGER NOT NULL,
            origin_segment_timestamp TIMESTAMP NOT NULL,
            translated_segment_id INTEGER NOT NULL,
            translated_segment_timestamp TIMESTAMP NOT NULL
        );
    """)
    database.execute_sql("CREATE INDEX IF NOT EXISTS segments_origins_origin ON segments_origins (origin_segment_id, origin_segment_timestamp);")
    database.execute_sql("CREATE INDEX IF NOT EXISTS segments_origins_translated ON segments_origins (translated_segment_id, translated_segment_timestamp);")

    # Migrate existing data from sources.original_source_id to sources_origins
    # Only migrate where original_source_id is not null
    database.execute_sql("""
        INSERT INTO sources_origins (id, origin_source_id, translated_source_id)
        SELECT
            nextval('sources_origins_id_seq'),
            original_source_id,
            id
        FROM sources
        WHERE original_source_id IS NOT NULL
    """)

    # Migrate existing data from segments.original_segment_id to segments_origins
    # Only migrate where original_segment_id is not null
    database.execute_sql("""
        INSERT INTO segments_origins (
            id,
            origin_segment_id,
            origin_segment_timestamp,
            translated_segment_id,
            translated_segment_timestamp
        )
        SELECT
            nextval('segments_origins_id_seq'),
            original_segment_id,
            original_segment_timestamp,
            id,
            timestamp
        FROM segments
        WHERE original_segment_id IS NOT NULL
          AND original_segment_timestamp IS NOT NULL
    """)

    # Drop old columns from sources table
    database.execute_sql("ALTER TABLE sources DROP COLUMN IF EXISTS original_source_id")

    # Drop old columns from segments table
    database.execute_sql("ALTER TABLE segments DROP COLUMN IF EXISTS original_segment_id")
    database.execute_sql("ALTER TABLE segments DROP COLUMN IF EXISTS original_segment_timestamp")


def rollback(migrator, database, fake=False, **kwargs):
    db_proxy.initialize(database)

    # Restore old columns to sources table
    database.execute_sql("ALTER TABLE sources ADD COLUMN IF NOT EXISTS original_source_id INTEGER NULL")

    # Restore old columns to segments table
    database.execute_sql("ALTER TABLE segments ADD COLUMN IF NOT EXISTS original_segment_id INTEGER NULL")
    database.execute_sql("ALTER TABLE segments ADD COLUMN IF NOT EXISTS original_segment_timestamp TIMESTAMP NULL")

    # Migrate data back from sources_origins to sources.original_source_id
    database.execute_sql("""
        UPDATE sources
        SET original_source_id = so.origin_source_id
        FROM sources_origins so
        WHERE sources.id = so.translated_source_id
    """)

    # Migrate data back from segments_origins to segments
    database.execute_sql("""
        UPDATE segments
        SET
            original_segment_id = so.origin_segment_id,
            original_segment_timestamp = so.origin_segment_timestamp
        FROM segments_origins so
        WHERE segments.id = so.translated_segment_id
          AND segments.timestamp = so.translated_segment_timestamp
    """)

    # Drop tables
    database.execute_sql("DROP TABLE IF EXISTS segments_origins CASCADE;")
    database.execute_sql("DROP TABLE IF EXISTS sources_origins CASCADE;")

