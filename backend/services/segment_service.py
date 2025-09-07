from datetime import datetime
from docx import Document
from io import BytesIO
from peewee import fn
from playhouse.shortcuts import model_to_dict
import logging

from models import Segments
from services.source_service import create_or_update_sources

# Get logger for this module
logger = logging.getLogger(__name__)

def get_latest_segments(source_id):
    max_timestamp_subquery = (
        Segments
        .select(Segments.order, fn.MAX(Segments.timestamp).alias('max_timestamp'))
        .where(Segments.source_id == source_id)
        .group_by(Segments.order)
    )

    latest_segments_query = (
        Segments
        .select()
        .join(max_timestamp_subquery, on=(
            (Segments.order == max_timestamp_subquery.c.order) &
            (Segments.timestamp == max_timestamp_subquery.c.max_timestamp)
        ))
        .where(Segments.source_id == source_id)
    )

    return list(latest_segments_query.dicts())
    
def get_paragraphs_from_file(file) -> list[str]:
    try:
        content = file.file.read()
        document = Document(BytesIO(content))
        paragraphs = [p.text.strip() for p in document.paragraphs if p.text.strip()]

        return paragraphs

    except Exception as e:
        logger.error("Failed to create segment previews: %s", str(e))
        raise Exception(f"Failed to create segment previews: {str(e)}")

def store_segments(segments: list[dict]) -> list[dict]:
    """
    Save a list of segments to the database.
    Assumes each segment has all necessary fields (including timestamp, username, etc.).
    """
    required_fields = ["text", "source_id", "order", "timestamp", "username", "properties"]
    saved_segments = []

    sources_to_update = {}
    for segment_data in segments:
        missing = [key for key in required_fields if key not in segment_data]
        if missing:
            raise ValueError(f"Segment is missing required fields: {', '.join(missing)}")

        source_id = segment_data["source_id"]
        timestamp = segment_data["timestamp"]
        logger.info("%s", sources_to_update)
        logger.info("%s", source_id)
        if source_id not in sources_to_update or timestamp > sources_to_update[source_id]["modified_at"]:
            sources_to_update[source_id] = {"id": source_id, "modified_by": segment_data["username"], "modified_at": timestamp}

        insert_query = Segments.insert(segment_data).returning(Segments)
        inserted = insert_query.execute()
        segment = inserted[0]
        segment_dict = model_to_dict(segment)
        saved_segments.append(segment_dict)

    create_or_update_sources(list(sources_to_update.values()))

    return saved_segments
