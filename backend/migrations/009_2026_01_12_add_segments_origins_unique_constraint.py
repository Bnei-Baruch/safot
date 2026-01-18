"""
Add unique constraint to segments_origins table on (origin_segment_id, origin_segment_timestamp, translated_segment_id, translated_segment_timestamp).
"""
import peewee as pw

db_proxy = pw.DatabaseProxy()

def migrate(migrator, database, fake=False, **kwargs):
    db_proxy.initialize(database)

    # Add unique constraint to segments_origins
    database.execute_sql("""
        CREATE UNIQUE INDEX IF NOT EXISTS segments_origins_unique_idx
        ON segments_origins (origin_segment_id, origin_segment_timestamp, translated_segment_id, translated_segment_timestamp)
    """)


def rollback(migrator, database, fake=False, **kwargs):
    db_proxy.initialize(database)

    # Drop unique constraint from segments_origins
    database.execute_sql("DROP INDEX IF EXISTS segments_origins_unique_idx")
