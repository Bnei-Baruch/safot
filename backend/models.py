from peewee import PostgresqlDatabase, Model, IntegerField, DateTimeField, CharField, CompositeKey
from playhouse.postgres_ext import ArrayField, JSONField
import os
from dotenv import load_dotenv

load_dotenv()

db = PostgresqlDatabase(
    os.getenv('PG_DATABASE'),
    user=os.getenv('PG_USER'),
    password=os.getenv('PG_PASSWORD'),
    host=os.getenv('PG_HOST'),
    port=int(os.getenv('PG_PORT')),
    autorollback=True,
    **{'client_encoding': 'utf8', 'driver': 'psycopg'}
)

class Dictionary(Model):
    id = IntegerField()
    timestamp = DateTimeField()
    name = CharField()
    username = CharField()
    labels = ArrayField(CharField)

    class Meta:
        database = db
        primary_key = CompositeKey('id', 'timestamp')

class Rule(Model):
    id = IntegerField()
    timestamp = DateTimeField()
    name = CharField()
    username = CharField()
    type = CharField()
    dictionary_id = IntegerField()
    dictionary_timestamp = DateTimeField()
    properties = JSONField()

    class Meta:
        database = db
        primary_key = CompositeKey('id', 'timestamp')
        indexes = (
            (('dictionary_id', 'dictionary_timestamp'), True),
        )

db.connect()
db.create_tables([Dictionary, Rule])
