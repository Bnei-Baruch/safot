from datetime import datetime
from models import Source
from db import db
from playhouse.shortcuts import model_to_dict


def create_source(source_data: dict, username: str):
    """Create a new source and return it as a dictionary"""
    # Generate a new ID using the database sequence
    cursor = db.execute_sql("SELECT nextval('source_id_seq')")
    id_value = cursor.fetchone()[0]

    created_source = Source.create(
        id=id_value,
        username=username,
        **source_data
    )
    return model_to_dict(created_source) 