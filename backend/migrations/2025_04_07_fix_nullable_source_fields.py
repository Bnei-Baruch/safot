from playhouse.migrate import PostgresqlMigrator, migrate
from db import db

migrator = PostgresqlMigrator(db)

migrate(
    migrator.drop_not_null('source', 'labels'),
    migrator.drop_not_null('source', 'type'),
    migrator.drop_not_null('source', 'properties')
)

print("✅ Migration applied: made 'labels', 'type', 'properties' nullable in 'source'")
