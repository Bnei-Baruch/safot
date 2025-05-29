from peewee_migrate import Migrator
from db import db
from models import Source, Segment

migrator = Migrator(db)
