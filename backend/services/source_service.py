from datetime import datetime
from models import Source
from db import db
from playhouse.shortcuts import model_to_dict
import logging


def apply_dict(model_instance, data: dict):
    for field in model_instance._meta.fields:
        if field in data:
            setattr(model_instance, field, data[field])

def create_or_update_source(source_data: dict, username: str):
    """Create a new source or update existing and return it as a dictionary"""
    logging.info("source_data %s", source_data)
    if not source_data["id"]:
        # Generate a new ID using the database sequence
        cursor = db.execute_sql("SELECT nextval('source_id_seq')")
        id_value = cursor.fetchone()[0]

        created_source = Source.create(
            id=id_value,
            username=username,
            **source_data
        )
        return model_to_dict(created_source) 
    else:
        source = Source.get(Source.id == source_data["id"])
        apply_dict(source, source_data)
        source.save()
        return model_to_dict(source) 
