from datetime import datetime
from io import BytesIO
from docx import Document
from peewee import fn
from models import Segment
from playhouse.shortcuts import model_to_dict


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
def save_segment(
    username, text, source_id, order, properties,
    original_segment_id=None, original_segment_timestamp=None, existing_segment=None, custom_timestamp=None
):
    """
    General function to save a segment.
    - Uses `custom_timestamp` if provided 
    - If `existing_segment` is provided, it creates a new version with the same `id` but a new `timestamp`.
    - Otherwise, it creates a brand-new segment.
    """
    now = custom_timestamp or datetime.utcnow()

    if existing_segment:
        query = Segment.insert(
            id=existing_segment.id,
            timestamp=now,
            username=username,
            text=text,
            source_id=source_id,
            order=order,
            original_segment_id=original_segment_id or existing_segment.original_segment_id,
            original_segment_timestamp=original_segment_timestamp or existing_segment.original_segment_timestamp,
            properties=properties
        ).execute()
    else:
        query = Segment.create(
            timestamp=now,
            username=username,
            text=text,
            source_id=source_id,
            order=order,
            original_segment_id=original_segment_id,
            original_segment_timestamp=original_segment_timestamp,
            properties=properties
        )

    # Fetch the segment to ensure ID is loaded properly
    segment = Segment.get(Segment.timestamp == now,
                          Segment.source_id == source_id, Segment.order == order)

    return model_to_dict(segment)  # Return JSON to frontend

def save_segments_from_file(file, source_id, properties_dict, user_info):
    """
    Process a file and create multiple segments from it.
    Ensures all segments from the same file share the same timestamp.
    """
    try:
        content = file.file.read()
        document = Document(BytesIO(content))
        paragraphs = [p.text for p in document.paragraphs if p.text.strip()]
        now = datetime.utcnow()

        segments = []
        for order, text in enumerate(paragraphs):
            segment = save_segment(
                username=user_info['preferred_username'],
                text=text,
                source_id=source_id,
                order=order,
                properties={**properties_dict, "segment_type": "file"},
                custom_timestamp=now
            )
            segments.append(segment)

        return {"source_id": source_id, "segments": segments}

    except Exception as e:
        raise Exception(f"Failed to process file: {str(e)}")
    
def get_paragraphs_from_file(file) -> list[str]:
    
    try:
        content = file.file.read()
        document = Document(BytesIO(content))
        paragraphs = [p.text.strip() for p in document.paragraphs if p.text.strip()]

        return paragraphs

    except Exception as e:
        raise Exception(f"❌ Failed to create segment previews: {str(e)}")

def build_segments(
    texts: list[str],
    source_id: int,
    properties_dict: dict,
    user_info: dict,
    original_segments_metadata: dict[int, dict] | None = None
):
    """
    Build segment dicts (not saved to DB) from raw texts.
    If original_segments_metadata is provided, include original_segment_id and original_segment_timestamp.
    """
    now = datetime.utcnow()
    segments = []

    for order, text in enumerate(texts, start=1):
        segment_data = {
            "text": text,
            "source_id": source_id,
            "order": order,
            "username": user_info["preferred_username"],
            "timestamp": now,
            "properties": {**properties_dict}
        }

        if original_segments_metadata and order in original_segments_metadata:
            meta = original_segments_metadata[order]
            segment_data["original_segment_id"] = meta.get("id")
            segment_data["original_segment_timestamp"] = meta.get("timestamp")

        segments.append(segment_data)

    return segments

def create_segment(segment_data, user_info):
    """
    Create a new segment.
    """
    try:
        return save_segment(
            username=user_info['preferred_username'],
            text=segment_data["text"],
            source_id=segment_data["source_id"],
            order=segment_data["order"],
            properties={
                **segment_data.get("properties", {}), "segment_type": "user_translation"},
            original_segment_id=segment_data.get("original_segment_id"),
            original_segment_timestamp=segment_data.get(
                "original_segment_timestamp")
        )
    except Exception as e:
        raise Exception(f"Failed to create segment: {str(e)}")

def update_segment(segment_data, user_info):
    """
    new row is created with the same `id` but a new `timestamp`.
    """
    try:
        # Fetch the latest version of the existing segment
        existing_segment = (
            Segment.select()
            .where(Segment.source_id == segment_data["source_id"], Segment.order == segment_data["order"])
            .order_by(Segment.timestamp.desc())  # Get the latest version
            .first()
        )

        if not existing_segment:
            raise Exception("Cannot update: No existing translation found!")

        return save_segment(
            username=user_info['preferred_username'],
            text=segment_data["text"],
            source_id=segment_data["source_id"],
            order=segment_data["order"],
            properties={
                **segment_data.get("properties", {}), "segment_type": "edited"},
            original_segment_id=segment_data.get("original_segment_id"),
            original_segment_timestamp=segment_data.get(
                "original_segment_timestamp"),

            existing_segment=existing_segment
        )

    except Exception as e:
        raise Exception(f"Failed to update segment: {str(e)}")


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

        segment = Segment.create(**segment_data)
        saved_segments.append(model_to_dict(segment))

    return saved_segments

