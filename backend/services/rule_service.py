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


def store_rules(rules: list[dict]) -> list[dict]:
    """
    Save a list of rules to the database efficiently using bulk insert.
    Assumes each rule has all necessary fields including timestamp.
    """
    required_fields = ["name", "username", "type", "dictionary_id", "dictionary_timestamp", "timestamp", "properties"]

    for rule in rules:
        missing = [key for key in required_fields if key not in rule]
        if missing:
            raise ValueError(f"Rule is missing required fields: {', '.join(missing)}")

    inserted = Rule.insert_many(rules).returning(Rule).execute()
    return [model_to_dict(rule) for rule in inserted] 