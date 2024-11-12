from models import db, Dictionary, Rule

try:
    db.connect()
    db.create_tables([Dictionary, Rule], safe=True)  # safe=True avoids recreating tables if they already exist
    print("Database connected and tables created successfully!")
except Exception as e:
    print(f"Error: {e}")
finally:
    db.close()
