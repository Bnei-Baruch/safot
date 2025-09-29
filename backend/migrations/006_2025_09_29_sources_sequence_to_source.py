"""
Rename sequence from sources_id_seq to source_id_seq
and update the default value for the id column in the sources table.
"""

def migrate(migrator, database, fake=False, **kwargs):
    # Using execute_sql for ALTER SEQUENCE and ALTER TABLE operations
    migrator.execute_sql("ALTER SEQUENCE sources_id_seq RENAME TO source_id_seq;")
    migrator.execute_sql("ALTER TABLE sources ALTER COLUMN id SET DEFAULT nextval('source_id_seq'::regclass);")

def rollback(migrator, database, fake=False, **kwargs):
    # Revert the changes made in the migrate function
    migrator.execute_sql("ALTER SEQUENCE source_id_seq RENAME TO sources_id_seq;")
    migrator.execute_sql("ALTER TABLE sources ALTER COLUMN id SET DEFAULT nextval('sources_id_seq'::regclass);")
