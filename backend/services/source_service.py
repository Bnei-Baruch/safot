from datetime import datetime
from models import (
    Segments,
    Sources,
    SourcesOrigins,
)
from db import db
from peewee import (
    JOIN,
    fn,
)
from playhouse.shortcuts import model_to_dict
import logging
from services.utils import (
	apply_dict,
    microseconds,
)

def get_origin_sources(translated_source_id: int) -> list[dict]:
    """Get all origin sources linked to a translated source via SourcesOrigins."""
    origin_source_ids = [
        link.origin_source_id 
        for link in SourcesOrigins.select().where(
            SourcesOrigins.translated_source_id == translated_source_id
        )
    ]
    
    if not origin_source_ids:
        return []
    
    query = Sources.select(
        Sources.id,
        Sources.name,
        Sources.language,
    ).where(Sources.id.in_(origin_source_ids))
    
    result = list(query.dicts())
    logging.info(f"Found {len(origin_source_ids)} origin source IDs for translated_source_id")
    return result

def get_sources(metadata: bool = False, source_id: int | None = None) -> list[dict]:
    if not metadata:
        query = Sources.select(
            Sources,
            microseconds(Sources.created_at, 'created_at_epoch'),
            microseconds(Sources.modified_at, 'modified_at_epoch'),
            microseconds(Sources.dictionary_timestamp, 'dictionary_timestamp_epoch'),
        )
        if source_id is not None:
            query = query.where(Sources.id == source_id)

        sources = list(query.dicts())
        
        # Add origin sources information for each source
        for source in sources:
            if source.get('id'):
                origin_sources = get_origin_sources(source['id'])
                source['origin_sources'] = origin_sources
        
        return sources

    # Segments have versions, count one segment per order.
    unique_segments_per_source = (
        Segments
        .select(Segments.order, Segments.source_id)
        .group_by(Segments.order, Segments.source_id)
    )
    if source_id is not None:
        query = query.where(unique_segments_per_source.id == source_id)

    query = (
        Sources
        .select(
            Sources,
            microseconds(Sources.created_at, 'created_at_epoch'),
            microseconds(Sources.modified_at, 'modified_at_epoch'),
            microseconds(Sources.dictionary_timestamp, 'dictionary_timestamp_epoch'),
            fn.COUNT(unique_segments_per_source.c.order).alias("count"),
        )
        .join(unique_segments_per_source, JOIN.LEFT_OUTER, on=(unique_segments_per_source.c.source_id == Sources.id))
        .group_by(Sources.id)
    )
    if source_id is not None:
        query = query.where(Sources.id == source_id)
    sources = list(query.dicts())
    
    # Add origin sources information for each source
    for source in sources:
        if source.get('id'):
            origin_sources = get_origin_sources(source['id'])
            source['origin_sources'] = origin_sources
    
    return sources

def create_or_update_sources(sources: list[dict], username: str = ""):
    """Create a new source or update existing and return it as a dictionary"""
    for source_data in sources:
        logging.info("source_data %s", source_data)
        now = datetime.utcnow()
        if not "id" in source_data or not source_data["id"]:
            # Generate a new ID using the database sequence
            cursor = db.execute_sql("SELECT nextval('source_id_seq')")
            id_value = cursor.fetchone()[0]

            created_source = Sources.create(
                id=id_value,
                username=username,
                created_at=now,
                modified_by=username,
                modified_at=now,
                **source_data
            )
            return model_to_dict(created_source) 
        else:
            source = Sources.get(Sources.id == source_data["id"])
            if username:
                source.modified_by = username
                source.modified_at = now
            apply_dict(source, source_data)
            source.save()
            return model_to_dict(source) 
