from peewee_migrate import Router
from models import db  # Import the database instance from models.py

router = Router(db)  # Initialize the router with the database connection

# Apply all pending migrations
router.run()
