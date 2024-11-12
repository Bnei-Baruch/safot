import os
from psycopg import connect
from dotenv import load_dotenv

load_dotenv()

try:
    conn = connect(
        dbname=os.getenv('PG_DATABASE'),
        user=os.getenv('PG_USER'),
        password=os.getenv('PG_PASSWORD'),
        host=os.getenv('PG_HOST'),
        port=os.getenv('PG_PORT')
    )
    print("Database connection successful!")
    conn.close()
except Exception as e:
    print(f"Error connecting to the database: {e}")
