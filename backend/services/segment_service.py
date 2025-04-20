from datetime import datetime
from io import BytesIO
from docx import Document
from peewee import fn
import logging
from models import Segment
from playhouse.shortcuts import model_to_dict

# Get logger for this module
logger = logging.getLogger(__name__)

def get_latest_segments(source_id):

    max_timestamp_subquery = (
        Segment
        .select(Segment.order, fn.MAX(Segment.timestamp).alias('max_timestamp'))
        .where(Segment.source_id == source_id)
        .group_by(Segment.order)
    )

    latest_segments_query = (
        Segment
        .select()
        .join(max_timestamp_subquery, on=(
            (Segment.order == max_timestamp_subquery.c.order) &
            (Segment.timestamp == max_timestamp_subquery.c.max_timestamp)
        ))
        .where(Segment.source_id == source_id)
    )

    latest_segments = list(latest_segments_query.dicts())


    return latest_segments
    
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

    for segment_data in segments:
        missing = [key for key in required_fields if key not in segment_data]
        if missing:
            raise ValueError(f"Segment is missing required fields: {', '.join(missing)}")

        insert_query = Segment.insert(segment_data).returning(Segment)
        inserted = insert_query.execute()
        segment = inserted[0]
        segment_dict = model_to_dict(segment)
        saved_segments.append(segment_dict)

    return saved_segments
