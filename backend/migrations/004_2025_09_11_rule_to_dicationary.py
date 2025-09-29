"""
Rule pointing to it's dictionary should not include timestamp.
It should be implicitly calculated by rule timestamp.
Basically dictionary timestamp >= rule timestamp.
"""
import peewee as pw

def migrate(migrator, database, fake=False, **kwargs):
    migrator.drop_columns("rules", "dictionary_timestamp")
    database.execute_sql("""
        DROP INDEX IF EXISTS rule_dictionary_id_dictionary_timestamp;
        CREATE INDEX IF NOT EXISTS rule_dictionary_id ON rules (dictionary_id);
    """)

def rollback(migrator, database, fake=False, **kwargs):
    migrator.add_columns("rules", dictionary_timestamp=pw.DateTimeField(null=True))
    database.execute_sql("""
        DROP INDEX IF EXISTS rule_dictionary_id;
        CREATE INDEX IF NOT EXISTS rule_dictionary_id_dictionary_timestamp
          ON rules (dictionary_id, dictionary_timestamp);
    """)

