from datetime import datetime
from io import BytesIO
from docx import Document
from models import Segment
from playhouse.shortcuts import model_to_dict


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
            properties={**properties, "segment_type": "edited"}
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
            properties={**properties, "segment_type": "user_translation"}
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
            properties=segment_data.get("properties", {}),
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
            properties=segment_data.get("properties", {}),
            original_segment_id=segment_data.get("original_segment_id"),
            original_segment_timestamp=segment_data.get(
                "original_segment_timestamp"),
            existing_segment=existing_segment
        )

    except Exception as e:
        raise Exception(f"Failed to update segment: {str(e)}")
