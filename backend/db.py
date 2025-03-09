import os
from dotenv import load_dotenv
from peewee import PostgresqlDatabase


load_dotenv()

db = PostgresqlDatabase(
    os.getenv('PG_DATABASE'),
    user=os.getenv('PG_USER'),
    password=os.getenv('PG_PASSWORD'),
    host=os.getenv('PG_HOST'),
    port=os.getenv('PG_PORT')
)
