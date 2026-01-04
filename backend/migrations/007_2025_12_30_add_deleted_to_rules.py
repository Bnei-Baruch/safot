"""
Add deleted boolean field to rules table for soft deletion.
This allows maintaining history while hiding deleted rules.
"""

def migrate(migrator, database, fake=False, **kwargs):
    # Add the deleted column with default False
    database.execute_sql(
        "ALTER TABLE rules ADD COLUMN IF NOT EXISTS deleted BOOLEAN NOT NULL DEFAULT FALSE;"
    )

def rollback(migrator, database, fake=False, **kwargs):
    # Remove the deleted column
    database.execute_sql("ALTER TABLE rules DROP COLUMN IF EXISTS deleted;")
