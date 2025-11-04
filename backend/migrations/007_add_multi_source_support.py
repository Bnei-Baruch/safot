"""Add multi-source translation support tables."""
import peewee as pw

# Use proxy pattern like other migrations to avoid model conflicts
db_proxy = pw.DatabaseProxy()

class _Base(pw.Model):
    class Meta:
        database = db_proxy

class SourceTranslationLinks(_Base):
    id = pw.AutoField(primary_key=True)
    origin_source_id = pw.IntegerField()
    translated_source_id = pw.IntegerField()

    class Meta:
        database = db_proxy
        table_name = 'source_translation_links'
        indexes = (
            (('origin_source_id',), False),
            (('translated_source_id',), False),
        )

class SegmentTranslationLinks(_Base):
    id = pw.AutoField(primary_key=True)
    origin_segment_id = pw.IntegerField()
    origin_segment_timestamp = pw.DateTimeField()
    translated_segment_id = pw.IntegerField()
    translated_segment_timestamp = pw.DateTimeField()

    class Meta:
        database = db_proxy
        table_name = 'segment_translation_links'
        indexes = (
            (('origin_segment_id', 'origin_segment_timestamp'), False),
            (('translated_segment_id', 'translated_segment_timestamp'), False),
        )

def migrate(migrator, database, fake=False, **kwargs):
    db_proxy.initialize(database)
    
    # Drop tables if they exist with wrong structure (from previous incorrect migration)
    # This is safe because these are link tables with no critical data
    if database.table_exists('source_translation_links'):
        logger = kwargs.get('logger', print)
        logger("Dropping existing source_translation_links and segment_translation_links tables to fix structure...")
        database.execute_sql("DROP TABLE IF EXISTS source_translation_links CASCADE;")
        database.execute_sql("DROP TABLE IF EXISTS segment_translation_links CASCADE;")
    
    # Create tables with correct structure
    migrator.create_model(SourceTranslationLinks)
    migrator.create_model(SegmentTranslationLinks)

def rollback(migrator, database, fake=False, **kwargs):
    migrator.remove_model('segmenttranslationlinks')
    migrator.remove_model('sourcetranslationlinks')
