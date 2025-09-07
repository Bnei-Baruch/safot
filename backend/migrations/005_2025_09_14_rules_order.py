"""
Rules should be ordered.
"""
import peewee as pw

def migrate(migrator, database, fake=False, **kwargs):
    migrator.add_columns("rules", order=pw.IntegerField(null=True))

def rollback(migrator, database, fake=False, **kwargs):
    migrator.drop_columns("rules", "order")

