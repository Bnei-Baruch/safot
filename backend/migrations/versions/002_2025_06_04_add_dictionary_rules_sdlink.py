"""Peewee migrations."""
import datetime as dt
import peewee as pw
from models import Dictionary, Rule, SourceDictionaryLink


def migrate(migrator, database, fake=False, **kwargs):
    migrator.create_model(Dictionary)
    migrator.create_model(Rule)
    migrator.create_model(SourceDictionaryLink)


def rollback(migrator, database, fake=False, **kwargs):
    migrator.remove_model('sourcedictionarylink')
    migrator.remove_model('rule')
    migrator.remove_model('dictionary')
