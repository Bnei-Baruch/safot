from playhouse.migrate import PostgresqlMigrator, migrate
from db import db
import logging

logger = logging.getLogger(__name__)

migrator = PostgresqlMigrator(db)

migrate(
    migrator.drop_not_null('source', 'labels'),
    migrator.drop_not_null('source', 'type'),
    migrator.drop_not_null('source', 'properties')
)

logger.info("Migration applied: made 'labels', 'type', 'properties' nullable in 'source'")
