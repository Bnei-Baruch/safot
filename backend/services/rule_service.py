from datetime import datetime
from playhouse.shortcuts import model_to_dict
from models import Rule, Dictionary
from peewee import *


def create_initial_prompt_rule(dictionary_id, dictionary_timestamp, username):
    """Create initial prompt rule for a new dictionary"""
    return Rule.create(
        name="initial_prompt_rule",
        username=username,
        type="prompt_key",
        dictionary_id=dictionary_id,
        dictionary_timestamp=dictionary_timestamp,
        properties={"prompt_key": "prompt_1"}
    )


def store_rules(rules: list[dict], username: str) -> list[dict]:
    """
    Save a list of rules to the database efficiently using bulk insert.
    Adds missing fields (id, username, timestamp) to rules from frontend.
    """
    from db import db
    
    now = datetime.utcnow()
    rules_to_insert = []
    
    for rule in rules:
        # Generate new ID using database sequence
        cursor = db.execute_sql("SELECT nextval('rule_id_seq')")
        rule_id = cursor.fetchone()[0]
        
        # Add missing fields
        rule_with_id = {
            **rule,
            'id': rule_id,
            'username': username,
            'timestamp': now
        }
        rules_to_insert.append(rule_with_id)

    inserted = Rule.insert_many(rules_to_insert).returning(Rule).execute()
    return [model_to_dict(rule) for rule in inserted]
