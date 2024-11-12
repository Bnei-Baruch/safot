import pg8000
import os
from dotenv import load_dotenv

load_dotenv()  # Load environment variables from .env file

try:
    connection = pg8000.connect(
        database=os.getenv('PG_DATABASE'),
        user=os.getenv('PG_USER'),
        password=os.getenv('PG_PASSWORD'),
        host=os.getenv('PG_HOST'),
        port=int(os.getenv('PG_PORT'))
    )
    print("Database connection successful!")
    connection.close()
except Exception as e:
    print(f"Error connecting to the database: {e}")
