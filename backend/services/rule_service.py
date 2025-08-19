from datetime import datetime
from playhouse.shortcuts import model_to_dict
from models import Rule, Dictionary
from peewee import *


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

def get_rules_by_dictionary(dictionary_id: int, dictionary_timestamp: datetime) -> list[dict]:
    """
    Fetch all rules matching a given dictionary ID and timestamp.
    """
    rules = (
        Rule
        .select()
        .where(
            (Rule.dictionary_id == dictionary_id) &
            (Rule.dictionary_timestamp == dictionary_timestamp)
        )
        .order_by(Rule.timestamp.asc())
    )
    return [model_to_dict(rule) for rule in rules]

def get_rules_by_dictionary_all(dictionary_id: int) -> list[dict]:
    """
    Fetch all rules for a dictionary across all timestamps (versions).
    """
    print(f"Looking for rules with dictionary_id={dictionary_id}")
    rules = (
        Rule
        .select()
        .where(Rule.dictionary_id == dictionary_id)
        .order_by(Rule.timestamp.asc())
    )
    return [model_to_dict(rule) for rule in rules]
