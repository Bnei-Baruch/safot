from datetime import datetime
from models import Dictionary, SourceDictionaryLink
from db import db
 

def create_new_dictionary(source_id, username, timestamp, name):
    """Create a new dictionary for a source and return a fully loaded object with ID."""
    # Generate a new ID using the database sequence
    cursor = db.execute_sql("SELECT nextval('dictionary_id_seq')")
    id_value = cursor.fetchone()[0]
    
    dictionary = Dictionary.create(
        id=id_value,
        name=name,
        username=username,
        timestamp=timestamp
    )
    return dictionary



def create_new_dictionary_version(original_dictionary_id, source_id, username, timestamp, original_name):
    """Create a new version of an existing dictionary."""
    d = Dictionary.create(
        id=original_dictionary_id,
        name=original_name,  # Use the original name instead of creating new one
        username=username,
        timestamp=timestamp
    )
    return {
        "dictionary_id": d.id,
        "dictionary_timestamp": d.timestamp.isoformat()
    }



def create_source_dictionary_link(source_id, dictionary_id, dictionary_timestamp):
    """Create a link between source and dictionary"""
    return SourceDictionaryLink.create(
        source_id=source_id,
        dictionary_id=dictionary_id,
        dictionary_timestamp=dictionary_timestamp,
        origin="self"
    ) 