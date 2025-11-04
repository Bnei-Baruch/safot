from datetime import datetime
from typing import List, Dict, Optional
import logging
import json
import re

from models import (
    SourceTranslationLinks,
    SegmentTranslationLinks,
    Sources,
    Segments,
)
from services.segment_service import (
    get_paragraphs_from_file,
    store_segments,
    get_latest_segments,
)
from services.translation_service import TranslationService

logger = logging.getLogger(__name__)


# Error handling classes
class MultiSourceTranslationError(Exception):
    """Base exception for multi-source translation errors"""
    pass


class OriginSourceNotFoundError(MultiSourceTranslationError):
    """Origin source not found"""
    pass


class NonOriginTextExhaustedError(MultiSourceTranslationError):
    """Non-origin source text exhausted before alignment"""
    pass


class AIAlignmentFailedError(MultiSourceTranslationError):
    """AI failed to provide valid alignment response"""
    pass


# Utility functions
def _parse_properties(properties) -> dict:
    """Parse properties from string or dict."""
    if isinstance(properties, dict):
        return properties
    if isinstance(properties, str):
        try:
            return json.loads(properties)
        except:
            return {}
    return {}


def _find_storage_segment(segments: List[dict]) -> Optional[dict]:
    """Find storage segment (order=0 with multi_source_storage flag)."""
    for seg in segments:
        order = seg.get('order')
        props = _parse_properties(seg.get('properties', {}))
        if order == 0 and props.get('multi_source_storage'):
            return seg
    return None


def _create_source_link(origin_source_id: int, translated_source_id: int) -> bool:
    """Create source translation link if it doesn't exist. Returns True if created."""
    existing = SourceTranslationLinks.select().where(
        SourceTranslationLinks.origin_source_id == origin_source_id,
        SourceTranslationLinks.translated_source_id == translated_source_id
    ).first()
    
    if existing:
        return False
    
    try:
        SourceTranslationLinks.create(
            origin_source_id=origin_source_id,
            translated_source_id=translated_source_id
        )
        return True
    except Exception as e:
        logger.error("Failed to create source link (origin=%d, translated=%d): %s", 
                    origin_source_id, translated_source_id, str(e))
        raise


def _create_storage_segment(source_id: int, text: str, username: str) -> bool:
    """Create a storage segment for multi-source storage. Returns True if successful."""
    segment_data = {
        "text": text,
        "source_id": source_id,
        "order": 0,
        "timestamp": datetime.utcnow(),
        "username": username,
        "properties": {
            "multi_source_storage": True,
            "segment_type": "multi_source_storage"
        }
    }
    try:
        stored = store_segments([segment_data])
        return stored and len(stored) > 0
    except Exception as e:
        logger.error("Failed to create storage segment for source_id %d: %s", source_id, str(e))
        return False


def _collect_text_from_segments(segments: List[dict]) -> str:
    """Collect text from all segments with order > 0."""
    texts = []
    for seg in segments:
        order = seg.get('order')
        if order is not None and order > 0:
            text = seg.get('text', '').strip()
            if text:
                texts.append(text)
    return "\n\n".join(texts)


# Public API functions
def get_all_source_ids_for_translation(translated_source_id: int) -> List[int]:
    """Get all source IDs linked to a translated source for multi-source translation."""
    links = SourceTranslationLinks.select().where(
        SourceTranslationLinks.translated_source_id == translated_source_id
    )
    return [link.origin_source_id for link in links]


def get_origin_source_id(source_id: int) -> int:
    """Get the origin source ID by querying Sources with properties.is_origin=True."""
    try:
        source = Sources.get(Sources.id == source_id)
        if source.properties and source.properties.get('is_origin'):
            return source.id
        raise OriginSourceNotFoundError(f"Source {source_id} is not marked as origin")
    except Sources.DoesNotExist:
        raise OriginSourceNotFoundError(f"Source {source_id} not found")


def get_non_origin_source_ids(origin_source_id: int, translated_source_id: int) -> List[int]:
    """Get all non-origin source IDs linked to the translated source, excluding the origin."""
    links = SourceTranslationLinks.select().where(
        SourceTranslationLinks.translated_source_id == translated_source_id
    )
    return [
        link.origin_source_id for link in links 
        if link.origin_source_id != origin_source_id
    ]


def get_non_origin_texts_from_storage(non_origin_source_ids: List[int]) -> Dict[int, str]:
    """Get non-origin texts from storage segments."""
    non_origin_texts = {}
    for source_id in non_origin_source_ids:
        try:
            segments = get_latest_segments(source_id)
            storage_segment = _find_storage_segment(segments)
            
            if storage_segment:
                non_origin_texts[source_id] = storage_segment.get('text', '')
            else:
                non_origin_texts[source_id] = ''
        except Exception as e:
            logger.error("Error retrieving storage text for source_id %d: %s", source_id, str(e), exc_info=True)
            non_origin_texts[source_id] = ''
    
    return non_origin_texts


def build_multi_source_prompt(
    base_prompt: str,
    non_origin_portions: Dict[int, str],
    source_language: str,
    target_language: str
) -> str:
    """Build prompt string with multi-source context."""
    prompt_parts = [base_prompt]
    
    if non_origin_portions:
        prompt_parts.append("\n\nAdditional reference sources in different languages:")
        for source_id, text_portion in non_origin_portions.items():
            if text_portion:
                prompt_parts.append(f"\nSource {source_id} (text): {text_portion}...")
    
    return "\n".join(prompt_parts)


def _ensure_table_exists():
    """Ensure source_translation_links table exists."""
    try:
        if not SourceTranslationLinks.table_exists():
            logger.warning("source_translation_links table does not exist, creating...")
            SourceTranslationLinks.create_table()
            logger.info("Created source_translation_links table")
    except Exception as e:
        logger.error("Error checking/creating source_translation_links table: %s", str(e), exc_info=True)


def _create_source_links(
    origin_source_id: int,
    non_origin_source_ids: List[int],
    translated_source_id: int
) -> None:
    """Create all source translation links."""
    _ensure_table_exists()
    
    # Create origin link
    try:
        _create_source_link(origin_source_id, translated_source_id)
    except Exception as e:
        logger.error("Error creating origin source link: %s", str(e))
    
    # Create non-origin links
    created_count = 0
    for non_origin_source_id in non_origin_source_ids:
        try:
            if _create_source_link(non_origin_source_id, translated_source_id):
                created_count += 1
        except Exception as e:
            logger.error("Error creating non-origin source link for source_id %d: %s", 
                        non_origin_source_id, str(e))
    
    # Verify links
    all_links = SourceTranslationLinks.select().where(
        SourceTranslationLinks.translated_source_id == translated_source_id
    )
    actual_count = all_links.count()
    expected_count = len(non_origin_source_ids) + 1
    
    if actual_count != expected_count:
        logger.warning("Link count mismatch! Expected %d, found %d", expected_count, actual_count)
    else:
        logger.info("Created/verified %d source links", actual_count)


def _process_non_origin_files(
    non_origin_files: List,
    non_origin_source_ids: List[int],
    username: str
) -> Dict[int, str]:
    """Process non-origin files and store as storage segments."""
    non_origin_texts = {}
    for i, file in enumerate(non_origin_files):
        if i >= len(non_origin_source_ids):
            break
        
        source_id = non_origin_source_ids[i]
        paragraphs = get_paragraphs_from_file(file)
        full_text = "\n\n".join(paragraphs)
        
        if _create_storage_segment(source_id, full_text, username):
            non_origin_texts[source_id] = full_text
            logger.info("Stored non-origin text for source_id %d: %d chars", source_id, len(full_text))
    
    return non_origin_texts


def _process_existing_segments(
    non_origin_source_ids: List[int],
    username: str
) -> Dict[int, str]:
    """Process existing segments and create storage segments if needed."""
    non_origin_texts = {}
    
    for source_id in non_origin_source_ids:
        segments = get_latest_segments(source_id)
        storage_segment = _find_storage_segment(segments)
        
        if storage_segment:
            # Use existing storage segment
            text = storage_segment.get('text', '')
            non_origin_texts[source_id] = text
            logger.info("Using existing storage segment for source_id %d: %d chars", source_id, len(text))
        else:
            # Create storage segment from existing segments
            full_text = _collect_text_from_segments(segments)
            if full_text:
                if _create_storage_segment(source_id, full_text, username):
                    non_origin_texts[source_id] = full_text
                    logger.info("Created storage segment for source_id %d: %d chars", source_id, len(full_text))
                else:
                    non_origin_texts[source_id] = ''
            else:
                non_origin_texts[source_id] = ''
                logger.warning("No text found for non-origin source_id %d", source_id)
    
    return non_origin_texts


def initialize_multi_source_translation(
    non_origin_files: List,
    origin_source_id: int,
    non_origin_source_ids: List[int],
    translated_source_id: int,
    username: str = ""
) -> Dict:
    """Initialize multi-source translation."""
    
    # Create source links
    _create_source_links(origin_source_id, non_origin_source_ids, translated_source_id)
    
    # Process non-origin sources
    if non_origin_files:
        non_origin_texts = _process_non_origin_files(non_origin_files, non_origin_source_ids, username)
    else:
        non_origin_texts = _process_existing_segments(non_origin_source_ids, username)
    
    # Get origin segments
    try:
        origin_segments = get_latest_segments(origin_source_id)
    except Exception as e:
        logger.error("Failed to get origin segments for source_id %d: %s", origin_source_id, str(e), exc_info=True)
        origin_segments = []
    
    return {
        'origin_segments': origin_segments,
        'non_origin_texts': non_origin_texts
    }


def send_to_ai_for_alignment(
    translation_service: TranslationService,
    origin_segments: List[str],
    non_origin_portions: Dict[int, str],
    prompt: str
) -> tuple[List[str], Dict[int, List[int]]]:
    """Send to AI for translation with multi-source alignment."""
    enhanced_prompt = build_multi_source_prompt(prompt, non_origin_portions, "", "")
    chunk_text = " ||| ".join(origin_segments)
    
    translated_text = translation_service.send_chunk_for_translation(chunk_text, enhanced_prompt)
    
    if not translated_text or "Translation failed" in translated_text:
        raise AIAlignmentFailedError(f"AI translation failed: {translated_text}")
    
    translated_segments = re.split(r'\s*\|\|\|\s*', translated_text.strip())
    split_indexes = {}
    
    return translated_segments, split_indexes


def _get_non_origin_texts_from_storage(translated_source_id: int, origin_segment_batch: List[dict]) -> Dict[int, str]:
    """Retrieve non-origin texts from storage if not provided."""
    try:
        translated_source = Sources.get(Sources.id == translated_source_id)
        origin_source_id = translated_source.original_source_id
        
        if not origin_source_id and origin_segment_batch:
            origin_source_id = origin_segment_batch[0].get('source_id')
        
        if not origin_source_id:
            logger.warning("Could not determine origin_source_id")
            return {}
        
        all_source_ids = get_all_source_ids_for_translation(translated_source_id)
        non_origin_source_ids = [sid for sid in all_source_ids if sid != origin_source_id]
        
        if non_origin_source_ids:
            return get_non_origin_texts_from_storage(non_origin_source_ids)
        
    except Sources.DoesNotExist:
        logger.error("Translated source %d not found", translated_source_id)
    except Exception as e:
        logger.error("Error retrieving non-origin texts from storage: %s", str(e), exc_info=True)
    
    return {}


def _extract_text_portions(
    non_origin_texts: Dict[int, str],
    origin_batch_chars: int,
    multiplier: float = 1.75
) -> tuple[Dict[int, str], Dict[int, str]]:
    """Extract text portions from non-origin sources. Returns (portions, updated_texts)."""
    target_chars_per_source = int(origin_batch_chars * multiplier)
    non_origin_portions = {}
    updated_texts = {}
    
    for source_id, remaining_text in non_origin_texts.items():
        if len(remaining_text) >= target_chars_per_source:
            portion = remaining_text[:target_chars_per_source]
            updated_texts[source_id] = remaining_text[target_chars_per_source:]
        else:
            portion = remaining_text
            updated_texts[source_id] = ''
            if not portion:
                logger.warning("Non-origin text exhausted for source_id %d", source_id)
        
        non_origin_portions[source_id] = portion
    
    return non_origin_portions, updated_texts


def process_translation_batch(
    origin_segment_batch: List[dict],
    non_origin_texts: Dict[int, str],
    prompt_text: str,
    source_language: str,
    target_language: str,
    translation_service: TranslationService,
    translated_source_id: int
) -> Dict:
    """Process a batch of translation with multi-source alignment."""
    
    # Verify initialization
    links_exist = SourceTranslationLinks.select().where(
        SourceTranslationLinks.translated_source_id == translated_source_id
    ).exists()
    
    if not links_exist:
        raise MultiSourceTranslationError(
            "Multi-source translation not initialized. Please call /multi-source/initialize first."
        )
    
    # Get non-origin texts from storage if needed
    if not non_origin_texts:
        non_origin_texts = _get_non_origin_texts_from_storage(translated_source_id, origin_segment_batch)
    
    if not non_origin_texts:
        raise MultiSourceTranslationError(
            "No non-origin reference texts available. Ensure sources are properly initialized."
        )
    
    # Extract origin segment texts
    origin_segments_text = [seg.get('text', '') for seg in origin_segment_batch]
    origin_batch_chars = sum(len(text) for text in origin_segments_text)
    
    # Extract text portions from non-origin sources
    non_origin_portions, updated_non_origin_texts = _extract_text_portions(
        non_origin_texts, origin_batch_chars
    )
    
    # Send to AI for alignment
    translated_segments, split_indexes = send_to_ai_for_alignment(
        translation_service,
        origin_segments_text,
        non_origin_portions,
        prompt_text
    )
    
    return {
        'translated_segments': translated_segments,
        'split_indexes': split_indexes,
        'non_origin_portions': non_origin_portions,
        'updated_non_origin_texts': updated_non_origin_texts
    }


def _parse_timestamp(ts) -> Optional[datetime]:
    """Parse timestamp from string or datetime object."""
    if isinstance(ts, datetime):
        return ts
    if isinstance(ts, str):
        try:
            return datetime.fromisoformat(ts.replace('Z', '+00:00'))
        except:
            logger.error("Failed to parse timestamp: %s", ts)
    return None


def _build_translated_segments_map(stored_segments: List[dict]) -> tuple[Dict[int, dict], set]:
    """Build a map of translated segments by order and return processed orders set."""
    translated_by_order = {}
    processed_orders = set()
    
    for stored_segment in stored_segments:
        order = stored_segment.get('order')
        if order is not None:
            translated_by_order[order] = stored_segment
            processed_orders.add(order)
        else:
            logger.warning("Stored segment missing order: %s", stored_segment.get('id'))
    
    return translated_by_order, processed_orders


def _create_single_link(
    origin_seg_id: int,
    origin_seg_ts: datetime,
    trans_seg_id: int,
    trans_seg_ts: datetime,
    link_type: str = "segment"
) -> bool:
    """Create a single translation link if it doesn't exist. Returns True if created."""
    try:
        existing = SegmentTranslationLinks.select().where(
            SegmentTranslationLinks.origin_segment_id == origin_seg_id,
            SegmentTranslationLinks.origin_segment_timestamp == origin_seg_ts,
            SegmentTranslationLinks.translated_segment_id == trans_seg_id,
            SegmentTranslationLinks.translated_segment_timestamp == trans_seg_ts
        ).first()
        
        if existing:
            return False
        
        SegmentTranslationLinks.create(
            origin_segment_id=origin_seg_id,
            origin_segment_timestamp=origin_seg_ts,
            translated_segment_id=trans_seg_id,
            translated_segment_timestamp=trans_seg_ts
        )
        return True
    except Exception as e:
        logger.error("Error creating %s link: %s", link_type, str(e), exc_info=True)
        return False


def _create_origin_links(
    origin_segment_batch: List[dict],
    translated_by_order: Dict[int, dict],
    processed_orders: set
) -> int:
    """Create links between origin segments and translated segments. Returns count of links created."""
    links_created = 0
    
    for origin_segment in origin_segment_batch:
        origin_order = origin_segment.get('order')
        if origin_order is None or origin_order not in processed_orders:
            continue
        
        translated_segment = translated_by_order.get(origin_order)
        if not translated_segment:
            logger.warning("No translated segment found for origin order %d", origin_order)
            continue
        
        origin_seg_id = origin_segment.get('id')
        origin_seg_ts = _parse_timestamp(origin_segment.get('timestamp'))
        trans_seg_id = translated_segment.get('id')
        trans_seg_ts = _parse_timestamp(translated_segment.get('timestamp'))
        
        if not all([origin_seg_id, origin_seg_ts, trans_seg_id, trans_seg_ts]):
            logger.warning("Missing required fields for origin link: origin_id=%s, origin_ts=%s, trans_id=%s, trans_ts=%s",
                         origin_seg_id, origin_seg_ts, trans_seg_id, trans_seg_ts)
            continue
        
        if _create_single_link(origin_seg_id, origin_seg_ts, trans_seg_id, trans_seg_ts, "origin segment"):
            links_created += 1
    
    return links_created


def _get_origin_source_id(translated_source_id: int) -> Optional[int]:
    """Get the origin source ID from source translation links."""
    links = SourceTranslationLinks.select().where(
        SourceTranslationLinks.translated_source_id == translated_source_id
    )
    
    for link in links:
        try:
            source = Sources.get(Sources.id == link.origin_source_id)
            if source.properties and source.properties.get('is_origin'):
                return source.id
        except Sources.DoesNotExist:
            continue
    
    return None


def _create_non_origin_links(
    translated_source_id: int,
    translated_by_order: Dict[int, dict],
    processed_orders: set
) -> int:
    """Create links between non-origin segments and translated segments. Returns count of links created."""
    links_created = 0
    
    try:
        source_links = SourceTranslationLinks.select().where(
            SourceTranslationLinks.translated_source_id == translated_source_id
        )
        
        origin_source_id = _get_origin_source_id(translated_source_id)
        logger.debug("Origin source ID: %s", origin_source_id)
        
        for source_link in source_links:
            non_origin_source_id = source_link.origin_source_id
            if non_origin_source_id == origin_source_id:
                continue
            
            non_origin_segments = get_latest_segments(non_origin_source_id)
            logger.debug("Processing non-origin source %d: %d segments, checking orders %s",
                        non_origin_source_id, len(non_origin_segments), sorted(processed_orders))
            
            for non_origin_seg in non_origin_segments:
                if non_origin_seg.get('order', 0) == 0:
                    continue
                
                non_origin_order = non_origin_seg.get('order')
                if non_origin_order is None or non_origin_order not in processed_orders:
                    continue
                
                translated_segment = translated_by_order.get(non_origin_order)
                if not translated_segment:
                    continue
                
                non_origin_seg_id = non_origin_seg.get('id')
                non_origin_seg_ts = _parse_timestamp(non_origin_seg.get('timestamp'))
                trans_seg_id = translated_segment.get('id')
                trans_seg_ts = _parse_timestamp(translated_segment.get('timestamp'))
                
                if not all([non_origin_seg_id, non_origin_seg_ts, trans_seg_id, trans_seg_ts]):
                    logger.warning("Missing required fields for non-origin link: non_origin_id=%s, non_origin_ts=%s, trans_id=%s, trans_ts=%s",
                                 non_origin_seg_id, non_origin_seg_ts, trans_seg_id, trans_seg_ts)
                    continue
                
                if _create_single_link(non_origin_seg_id, non_origin_seg_ts, trans_seg_id, trans_seg_ts, "non-origin segment"):
                    links_created += 1
    except Exception as e:
        logger.error("Error getting non-origin sources for segment linking: %s", str(e), exc_info=True)
    
    return links_created


def _create_segment_links(
    stored_segments: List[dict],
    origin_segment_batch: List[dict],
    translated_source_id: int
) -> None:
    """Create segment translation links."""
    
    translated_by_order, processed_orders = _build_translated_segments_map(stored_segments)
    
    if not processed_orders:
        return
    
    _create_origin_links(origin_segment_batch, translated_by_order, processed_orders)
    _create_non_origin_links(translated_source_id, translated_by_order, processed_orders)


def _update_storage_segments(
    non_origin_texts: Dict[int, str],
    username: str
) -> None:
    """Update storage segments with remaining non-origin texts."""
    timestamp = datetime.utcnow()
    
    for source_id, updated_text in non_origin_texts.items():
        segments = get_latest_segments(source_id)
        storage_segment = _find_storage_segment(segments)
        
        if storage_segment:
            segment_data = {
                "text": updated_text,
                "source_id": source_id,
                "order": 0,
                "timestamp": timestamp,
                "username": username,
                "properties": {
                    "multi_source_storage": True,
                    "segment_type": "multi_source_storage"
                }
            }
            store_segments([segment_data], update_existing=True)
        else:
            logger.warning("Storage segment not found for source_id %d, cannot update", source_id)


def _cleanup_storage_segments(
    translated_source_id: int,
    username: str
) -> None:
    """Delete all storage segments (order=0, multi_source_storage) for non-origin sources linked to translated_source_id."""
    from models import SourceTranslationLinks
    
    try:
        # Get all non-origin source IDs linked to this translation
        links = SourceTranslationLinks.select().where(
            SourceTranslationLinks.translated_source_id == translated_source_id
        )
        
        source_ids_to_cleanup = [link.origin_source_id for link in links]
        
        if not source_ids_to_cleanup:
            logger.info("No source links found for translated_source_id %d, skipping cleanup", translated_source_id)
            return
        
        # Delete all storage segments (order=0 with multi_source_storage property) for these sources
        deleted_count = 0
        for source_id in source_ids_to_cleanup:
            # Find storage segments
            segments = get_latest_segments(source_id)
            storage_segment = _find_storage_segment(segments)
            
            if storage_segment:
                # Delete all segments with this source_id and order=0
                count = Segments.delete().where(
                    (Segments.source_id == source_id) & (Segments.order == 0)
                ).execute()
                deleted_count += count
            
    except Exception as e:
        logger.error("Error cleaning up storage segments: %s", str(e), exc_info=True)


def _get_max_order_from_source(source_id: int) -> int:
    """Get the maximum order number from existing segments in a source."""
    existing_segments = get_latest_segments(source_id)
    if not existing_segments:
        return 0
    
    existing_orders = [seg.get('order', 0) for seg in existing_segments if seg.get('order', 0) > 0]
    return max(existing_orders) if existing_orders else 0


def _build_segments_to_store(
    translated_segments: List[str],
    origin_segment_batch: List[dict],
    translated_source_id: int,
    start_order: int,
    timestamp: datetime,
    username: str
) -> List[dict]:
    """Build segment data dictionaries for storing translated segments."""
    segments_to_store = []
    
    for i, translated_text in enumerate(translated_segments):
        origin_segment = origin_segment_batch[i] if i < len(origin_segment_batch) else None
        origin_order = origin_segment.get('order') if origin_segment else None
        segment_order = start_order + i
        
        segment_data = {
            "text": translated_text,
            "source_id": translated_source_id,
            "order": segment_order,
            "timestamp": timestamp,
            "username": username,
            "properties": {
                "segment_type": "translation",
                "multi_source": True
            }
        }
        
        if origin_segment:
            segment_data["original_segment_id"] = origin_segment.get('id')
            segment_data["original_segment_timestamp"] = origin_segment.get('timestamp')
            if origin_order:
                segment_data["properties"]["origin_order"] = origin_order
        
        segments_to_store.append(segment_data)
    
    return segments_to_store


def _verify_links_created(stored_segments: List[dict], translated_source_id: int) -> None:
    """Verify that translation links were created for stored segments."""
    try:
        stored_orders = [seg.get('order') for seg in stored_segments if seg.get('order') is not None]
        stored_order_set = set(stored_orders)
        
        for stored_order in stored_order_set:
            link_count = SegmentTranslationLinks.select().join(
                Segments, on=(
                    (SegmentTranslationLinks.translated_segment_id == Segments.id) &
                    (SegmentTranslationLinks.translated_segment_timestamp == Segments.timestamp)
                )
            ).where(
                Segments.source_id == translated_source_id,
                Segments.order == stored_order
            ).count()
    except Exception as e:
        logger.warning("Could not verify link creation: %s", str(e))


def _handle_non_origin_texts_storage(
    non_origin_texts: Dict[int, str],
    translated_source_id: int,
    username: str
) -> bool:
    """
    Update or clean up non-origin text storage based on translation completion.
    Returns True if translation is complete.
    """
    if not non_origin_texts:
        logger.warning("No non-origin texts to update in storage")
        return False
    
    translation_complete = all(
        not text or len(text.strip()) == 0 
        for text in non_origin_texts.values()
    )
    
    if translation_complete:
        _cleanup_storage_segments(translated_source_id, username)
    else:
        _update_storage_segments(non_origin_texts, username)
    
    return translation_complete


def update_database_after_batch(
    translated_segments: List[str],
    split_indexes: Dict[int, List[int]],
    non_origin_portions: Dict[int, str],
    translated_source_id: int,
    origin_segment_batch: List[dict],
    non_origin_texts: Dict[int, str],
    username: str = ""
) -> Dict:
    """Update database after batch translation."""
    
    timestamp = datetime.utcnow()
    max_order = _get_max_order_from_source(translated_source_id)
    start_order = max_order + 1
    
    segments_to_store = _build_segments_to_store(
        translated_segments, origin_segment_batch, translated_source_id,
        start_order, timestamp, username
    )
    
    stored_segments = store_segments(segments_to_store, update_existing=True)
    
    _create_segment_links(stored_segments, origin_segment_batch, translated_source_id)
    _verify_links_created(stored_segments, translated_source_id)
    
    translation_complete = _handle_non_origin_texts_storage(non_origin_texts, translated_source_id, username)
    
    return {
        'translated_segments': stored_segments,
        'updated_non_origin_texts': non_origin_texts,
        'translation_complete': translation_complete
    }
