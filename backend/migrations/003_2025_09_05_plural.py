"""
Rename tables to plural:
  dictionary -> dictionaries
  source     -> sources
  segment    -> segments
  rule       -> rules
"""

def migrate(migrator, database, fake=False, **kwargs):
    migrator.rename_table('dictionary', 'dictionaries')
    migrator.rename_table('source', 'sources')
    migrator.rename_table('segment', 'segments')
    migrator.rename_table('rule', 'rules')

def rollback(migrator, database, fake=False, **kwargs):
    migrator.rename_table('dictionaries', 'dictionary')
    migrator.rename_table('sources', 'source')
    migrator.rename_table('segments', 'segment')
    migrator.rename_table('rules', 'rule')
