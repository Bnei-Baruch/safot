from datetime import datetime
from docx import Document
from io import BytesIO
from peewee import fn
from playhouse.shortcuts import model_to_dict
import logging
import re

from models import Segments, SegmentsOrigins
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

def store_temporal_segments(segments_data: list[dict], username: str, timestamp: datetime) -> list[dict]:
    """
    Store temporal segments (order=0) for additional sources.
    Each entry in segments_data should have: source_id, text, properties
    """
    segments = []
    for segment_data in segments_data:
        segment = {
            "text": segment_data["text"],
            "source_id": segment_data["source_id"],
            "order": 0,
            "timestamp": timestamp,
            "username": username,
            "properties": segment_data["properties"],
        }
        segments.append(segment)
    
    return store_segments(segments)

def build_segments_from_paragraphs(
    paragraphs: list[str],
    source_id: int,
    properties: dict,
    username: str,
    timestamp: datetime,
    original_segments: list[dict] = None
) -> list[dict]:
    """Build segments from paragraphs with optional original segment references."""
    segments = []
    original_segments = original_segments or []
    
    for index, text in enumerate(paragraphs):
        original_segment = original_segments[index] if index < len(original_segments) else None
        order = (original_segment.get("order") if original_segment and original_segment.get("order") is not None 
                else (index + 1))
        
        segment = {
            "text": text,
            "source_id": source_id,
            "order": order,
            "properties": properties,
            "username": username,
            "timestamp": timestamp,
        }

        if original_segment:
            if original_segment.get("id"):
                segment["original_segment_id"] = original_segment["id"]
            if original_segment.get("timestamp"):
                segment["original_segment_timestamp"] = original_segment["timestamp"]
        
        segments.append(segment)
    
    return segments

def build_additional_sources_segments(
    additional_sources_segments: dict,
    properties: dict,
    username: str,
    timestamp: datetime
) -> list[dict]:
    """Build segments from additional sources segments dictionary (key format: "sourceId_language")."""
    segments = []
    source_segments_map: dict[int, list[str]] = {}

    for key, segments_text in additional_sources_segments.items():
        try:
            source_id = int(key.split('_')[0])
            source_segments_map[source_id] = segments_text
        except (ValueError, IndexError):
            logger.warning(f"Invalid source_id in additional_sources_segments key: {key}")

    if not source_segments_map:
        return segments

    source_ids = list(source_segments_map.keys())
    existing_orders = {
        row["source_id"]: row["max_order"] or 0
        for row in (
            Segments.select(
                Segments.source_id,
                fn.MAX(Segments.order).alias("max_order")
            )
            .where(
                (Segments.source_id.in_(source_ids)) &
                (Segments.order > 0)
            )
            .group_by(Segments.source_id)
            .dicts()
        )
    }

    for source_id, segments_text in source_segments_map.items():
        start_order = existing_orders.get(source_id, 0)
        for seg_index, seg_text in enumerate(segments_text):
            segments.append({
                "text": seg_text,
                "source_id": source_id,
                "order": start_order + seg_index + 1,
                "properties": properties,
                "username": username,
                "timestamp": timestamp,
            })
    
    return segments

def prepare_segments_for_storage(segments: list[dict], username: str, timestamp: datetime) -> list[dict]:
    """Add username and timestamp to segments for storage."""
    for segment in segments:
        segment["username"] = username
        segment["timestamp"] = timestamp
    return segments

def update_temporal_segments_remaining_text(
    additional_sources_segments: dict,
    username: str,
    timestamp: datetime
) -> None:
    """Update temporal segments (order=0) by removing consumed text, or delete if empty."""
    for key, segments_text in additional_sources_segments.items():
        if not segments_text:
            continue
            
        source_id = int(key.split('_')[0])
        
        # Get the latest temporal segment (order=0) directly from database
        try:
            temporal_segment = (Segments
                .select()
                .where((Segments.source_id == source_id) & (Segments.order == 0))
                .order_by(Segments.timestamp.desc())
                .get())
        except Segments.DoesNotExist:
            continue
        
        remaining_text = temporal_segment.text or ""
        for seg_text in segments_text:
            if not seg_text:
                continue
            if remaining_text.startswith(seg_text):
                remaining_text = remaining_text[len(seg_text):]
            else:
                pos = remaining_text.lower().find(seg_text.lower())
                remaining_text = remaining_text[:pos] + remaining_text[pos + len(seg_text):] if pos != -1 else remaining_text[len(seg_text):]
        
        # Remove newline characters, then leading dots (with optional whitespace), then spaces
        remaining_text = remaining_text.lstrip('\n\r')
        # Remove a single leading dot (with optional surrounding whitespace) only if it appears before text
        remaining_text = re.sub(r'^\s*\.\s*', '', remaining_text, count=1)
        remaining_text = remaining_text.lstrip()
        
        if not remaining_text:
            temporal_segment.delete_instance()
        else:
            # Use explicit update to ensure it works with composite primary key
            Segments.update(
                text=remaining_text,
                username=username
            ).where(
                (Segments.id == temporal_segment.id) & 
                (Segments.timestamp == temporal_segment.timestamp)
            ).execute()

def create_segment_origin_links(
    saved_segments: list[dict],
    translated_source_id: int,
    original_segments: list[dict] = None,
    additional_sources_segments: dict = None
) -> None:
    """Create links between origin segments and translated segments in segments_origins table."""
    original_segments = original_segments or []
    additional_sources_segments = additional_sources_segments or {}
    
    # Get main translated segments by order
    main_translated = {seg.get("order"): seg for seg in saved_segments if seg.get("source_id") == translated_source_id}
    
    # Link original segments to translated segments
    for orig_seg in original_segments:
        trans_seg = main_translated.get(orig_seg.get("order"))
        if trans_seg:
            SegmentsOrigins.create(
                origin_segment_id=orig_seg["id"],
                origin_segment_timestamp=orig_seg["timestamp"],
                translated_segment_id=trans_seg["id"],
                translated_segment_timestamp=trans_seg["timestamp"]
            )
    
    # Link additional source segments to translated segments (same order mapping)
    for key, segments_text in additional_sources_segments.items():
        try:
            source_id = int(key.split('_')[0])
        except (ValueError, IndexError):
            logger.warning(f"Invalid source_id in additional_sources_segments key: {key}")
            continue

        new_segments = [
            seg for seg in saved_segments
            if seg.get("source_id") == source_id
        ]
        if not new_segments:
            continue

        new_segments.sort(key=lambda seg: seg.get("order", 0))

        for seg_index, _ in enumerate(segments_text):
            if seg_index >= len(new_segments):
                break
            origin_seg = new_segments[seg_index]
            trans_seg = main_translated.get(origin_seg.get("order"))
            if origin_seg and trans_seg:
                SegmentsOrigins.create(
                    origin_segment_id=origin_seg["id"],
                    origin_segment_timestamp=origin_seg["timestamp"],
                    translated_segment_id=trans_seg["id"],
                    translated_segment_timestamp=trans_seg["timestamp"]
                )
