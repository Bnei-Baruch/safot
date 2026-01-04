"""
API-level integration tests for prompt generation with deleted rules
"""
import pytest


def test_prompt_excludes_deleted_rules(client, test_db):
    """
    Test that deleted rules are excluded from prompt generation.
    Creates two active rules, updates dict, then deletes one rule, updates dict again,
    and verifies only the active rule appears in prompt.
    """
    # Create dictionary
    dict_response = client.post("/dictionaries", json={"name": "Test Dictionary"})
    assert dict_response.status_code == 200
    dict_id = dict_response.json()["id"]

    # Create two active rules
    rules_response = client.post("/rules", json={
        "rules": [
            {
                "name": "Active Rule",
                "type": "text",
                "dictionary_id": dict_id,
                "properties": {"text": "Active content"},
                "order": 1,
                "deleted": False,
            },
            {
                "name": "Rule to Delete",
                "type": "text",
                "dictionary_id": dict_id,
                "properties": {"text": "Deleted content"},
                "order": 2,
                "deleted": False,
            }
        ]
    })
    assert rules_response.status_code == 200
    rule_to_delete_id = rules_response.json()[1]["id"]
    first_timestamp = rules_response.json()[0]["timestamp_epoch"]

    # Update dictionary with rules' timestamp
    dict_response_2 = client.post("/dictionaries", json={
        "id": dict_id,
        "name": "Test Dictionary",
        "timestamp_epoch": first_timestamp,
    })

    # Delete one rule
    delete_response = client.post("/rules", json={
        "rules": [
            {
                "id": rule_to_delete_id,
                "name": "Rule to Delete",
                "type": "text",
                "dictionary_id": dict_id,
                "properties": {"text": "Deleted content"},
                "order": 2,
                "deleted": True,
            }
        ]
    })
    assert delete_response.status_code == 200
    second_timestamp = delete_response.json()[0]["timestamp_epoch"]

    # Update dictionary with new timestamp after deletion
    dict_response_3 = client.post("/dictionaries", json={
        "id": dict_id,
        "name": "Test Dictionary",
        "timestamp_epoch": second_timestamp,
    })
    dict_timestamp = dict_response_3.json()["timestamp_epoch"]

    # Get prompt
    prompt_response = client.post("/prompt", json={
        "dictionary_id": dict_id,
        "dictionary_timestamp": dict_timestamp
    })
    assert prompt_response.status_code == 200
    prompt = prompt_response.json()

    # Print full prompt for debugging
    print(f"\n=== FULL PROMPT ===")
    print(repr(prompt))
    print(f"=== END PROMPT ===\n")

    # Verify only active rule in prompt
    assert prompt == "Active content", \
        f"Expected prompt='Active content', got prompt={repr(prompt)}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
