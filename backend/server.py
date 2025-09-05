from datetime import datetime
import os
import logging

from peewee import DoesNotExist, fn
from dotenv import load_dotenv
from docx import Document
from fastapi import Depends, FastAPI, HTTPException, Request, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from keycloak import KeycloakOpenID
from playhouse.shortcuts import model_to_dict
from starlette.status import HTTP_401_UNAUTHORIZED

from services.translation_service import TranslationService
from services.segment_service import get_paragraphs_from_file, get_latest_segments, store_segments
from services.rule_service import store_rules, get_rules_by_dictionary, get_rules_by_dictionary_all
from services.dictionary_service import create_new_dictionary, create_new_dictionary_version, create_source_dictionary_link
from services.source_service import create_or_update_source
from services.auth_decorators import *
from models import Source, Segment, ParagraphsTranslateRequest, TranslationServiceOptions, Dictionary, Rule, SourceDictionaryLink
from db import db
from peewee_migrate import Router


def configure_logging():
    """Configure logging for the entire application"""
    logging.basicConfig(
        level=logging.DEBUG,
        format='%(asctime)s - %(name)s - %(levelname)s - [%(filename)s:%(lineno)d] - %(message)s'
    )
    # Configure peewee logger
    peewee_logger = logging.getLogger('peewee')
    peewee_logger.setLevel(logging.INFO)

# Configure logging at startup
configure_logging()

logger = logging.getLogger(__name__)

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Keycloak
logger.info('Initializing keycloak with URL: %s, Client ID: %s, Realm: %s', 
            os.getenv('KEYCLOAK_SERVER_URL'),
            os.getenv('KEYCLOAK_CLIENT_ID'), 
            os.getenv('KEYCLOAK_REALM_NAME'))
keycloak_openid = KeycloakOpenID(
    server_url=os.getenv('KEYCLOAK_SERVER_URL'),
    client_id=os.getenv('KEYCLOAK_CLIENT_ID'),
    realm_name=os.getenv('KEYCLOAK_REALM_NAME'),
)

# User info middlware

async def get_user_info(request: Request):
    # Extract token from Authorization header
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        logger.error('Missing authorization header')
        raise HTTPException(status_code=HTTP_401_UNAUTHORIZED,
                            detail='Missing or invalid token')

    token = auth_header[len('Bearer '):].strip()
    try:
        # Validate token and get user info
        user_info = keycloak_openid.userinfo(token)
        return user_info
    except Exception as e:
        logger.error('Invalid or expired token: %s', e)
        raise HTTPException(status_code=HTTP_401_UNAUTHORIZED,
                            detail='Invalid or expired token')


@app.on_event('startup')
def startup():
    if db.is_closed():
        db.connect()
    
    router = Router(db, migrate_dir='migrations/versions')
    router.run()

    logger.info('Database connected and migrations applied')

@app.on_event('shutdown')
def shutdown():
    if not db.is_closed():
        db.close()
    logger.info('Database connection closed')

####### SOURCES
@app.get('/sources', response_model=list[dict])
@require_read
def read_sources(user_info: dict = Depends(get_user_info)):
    sources = list(Source.select().dicts())
    return sources

@app.get('/sources/{source_id}', response_model=dict)
@require_read
def read_source(source_id: int, user_info: dict = Depends(get_user_info)):
    try:
        source = Source.get(Source.id == source_id)
        return model_to_dict(source)
    except DoesNotExist:
        raise HTTPException(status_code=404, detail='Source not found')

@app.post('/sources', response_model=dict)
@require_write
def create_source_handler(source: dict, user_info: dict = Depends(get_user_info)):
    return create_source(source, user_info['preferred_username'])

""" Not used in frontend.
@app.put('/sources/{source_id}', response_model=dict)
def update_source(source_id: int, source: dict, user_info: dict = Depends(get_user_info)):
    try:
        # Update fields dynamically
        query = Source.update(
            **source, timestamp=datetime.utcnow()).where(Source.id == source_id)
        updated_rows = query.execute()

        if updated_rows == 0:
            raise HTTPException(status_code=404, detail='Source not found')
        db_source = Source.get(Source.id == source_id)
        return model_to_dict(db_source)
    except DoesNotExist:
        raise HTTPException(status_code=404, detail='Source not found')
"""

@app.delete('/sources/{translation_source_id}', response_model=list)
@require_write
def delete_source(translation_source_id: int, user_info: dict = Depends(get_user_info)):
    try:
        source = Source.get(Source.id == translation_source_id)
    except Exception as e:
        logger.error(f"Deletion - Source not found: {e}")
        raise HTTPException(status_code=404, detail='Source not found')

    # Get all translations of the original source
    translations = list(Source.select().where(Source.original_source_id == source.original_source_id))
    source_ids_to_delete = [translation_source_id]
    if len(translations) == 1:
        # This is the last translation, allow deletion of both translation and original
        source_ids_to_delete.append(source.original_source_id)

    # Delete all segments for these sources
    Segment.delete().where(Segment.source_id.in_(source_ids_to_delete)).execute()
    # Delete the sources themselves
    Source.delete().where(Source.id.in_(source_ids_to_delete)).execute()
    return source_ids_to_delete


####### SEGMENTS 
@app.get('/segments/{source_id}', response_model=list)
@require_read
def read_segments(source_id: int, user_info: dict = Depends(get_user_info)):
    try:
        # Sub query to get latest segments.
        subquery = (Segment
                .select(Segment.id, fn.MAX(Segment.timestamp).alias('latest_timestamp'))
                .where(Segment.source_id == source_id)
                .group_by(Segment.id))
        # Get all latest segments
        return list(Segment.select()
                       .where(Segment.source_id == source_id)
                       .join(subquery, on=(
                           (Segment.id == subquery.c.id) &
                           (Segment.timestamp == subquery.c.latest_timestamp)
                       ))
                       .order_by(Segment.order)
                       .dicts())
        
    except Exception as e:
        logger.error("Error fetching segments: %s", e)
        raise HTTPException(
            status_code=500, detail=f"Failed to fetch segments: {str(e)}")

@app.post('/segments', response_model=list[dict])
@require_write
async def save_segments(request: Request, user_info: dict = Depends(get_user_info)):
    try:
        data = await request.json()
        segments = data.get("segments", [])

        if not isinstance(segments, list):
            raise HTTPException(status_code=400, detail="Invalid request format - segments must be a list")

        # Add username and timestamp to each segment
        now = datetime.utcnow()
        for segment in segments:
            segment["username"] = user_info["preferred_username"]
            segment["timestamp"] = now

        saved_segments = store_segments(segments)
        return saved_segments

    except Exception as e:
        logger.error("Error in /segments: %s", e)
        raise HTTPException(status_code=500, detail="Failed to store segments")

####### TRANSLATION
@app.post("/translate", response_model=dict)
@require_write
def translate_paragraphs_handler(
    request: ParagraphsTranslateRequest,
    user_info: dict = Depends(get_user_info)
):
    try:
        start_time = datetime.utcnow()

        if not request.paragraphs:
            raise HTTPException(status_code=400, detail="No paragraphs provided.")
        
        if not request.prompt_text or not request.prompt_text.strip():
            raise HTTPException(status_code=400, detail="Missing prompt_text in request.")

        options = TranslationServiceOptions(
            source_language=request.source_language,
            target_language=request.target_language,
        )

        translation_service = TranslationService(
            api_key=OPENAI_API_KEY,
            options=options,
            examples=request.examples,
            prompt_text=request.prompt_text
        )

        translated_paragraphs, properties = translation_service.translate_paragraphs(
            paragraphs=request.paragraphs,
            dictionary_id=request.dictionary_id,
            dictionary_timestamp=request.dictionary_timestamp
        )

        end_time = datetime.utcnow()
        total_duration = (end_time - start_time).total_seconds()
        logger.info("Total translation time: %.2f seconds for %d paragraphs", total_duration, len(request.paragraphs))

        return {
            "translated_paragraphs": translated_paragraphs,
            "properties": properties,
            "total_segments_translated": len(translated_paragraphs),
            "translation_time_seconds": total_duration
        }

    except Exception as e:
        logger.error("Error in translation handler: %s", e)
        raise HTTPException(status_code=500, detail=f"Translation failed: {str(e)}")
    
####### IMPORT/EXPORT
@app.post('/docx2text')
@require_write
def extract_segments_handler(
    file: UploadFile = File(...),
    user_info: dict = Depends(get_user_info)
):
    if not file.filename.lower().endswith('.docx'):
        raise HTTPException(status_code=400, detail="Only .docx files are supported.")
    try:
        paragraphs = get_paragraphs_from_file(file)
        properties = {"segment_type": "file"}

        return  {
            "paragraphs": paragraphs,
            "properties": properties
        }
    except Exception as e:
        logger.error("Error in /docx2text: %s", e)
        raise HTTPException(status_code=500, detail="Failed to extract segments")
    
@app.get("/export/{source_id}", response_class=FileResponse)
@require_read
def export_translation(source_id: int, user_info: dict = Depends(get_user_info)):

    try:
        segments = get_latest_segments(source_id)

        if not segments:
            raise HTTPException(
                status_code=404, detail="No translated segments found.")

        # create a new document
        doc = Document()
        doc.add_heading("Translated Document", level=1)

        for segment in sorted(segments, key=lambda s: s['order']):
            doc.add_paragraph(segment["text"])

        # save the document to a temporary file
        file_path = f"/tmp/translated_{source_id}.docx"
        doc.save(file_path)

        return FileResponse(file_path, filename=f"translated_{source_id}.docx",
                            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document")

    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error generating DOCX: {str(e)}")


####### DICTIONARY
@app.post("/dictionary/new/{source_id}", response_model=dict)
@require_write
async def create_new_dictionary_handler(source_id: int, request: Request, user_info: dict = Depends(get_user_info)):
    try:
        data = await request.json()
        dictionary_name = data["name"]
        
        now = datetime.utcnow()
        
        # Create new dictionary
        dictionary = create_new_dictionary(
            source_id,
            user_info["preferred_username"],
            now,
            dictionary_name
        )
        
        # Create source dictionary link
        create_source_dictionary_link(
            source_id,
            dictionary.id,
            dictionary.timestamp
        )
        
        return {
            "dictionary_id": dictionary.id,
            "dictionary_timestamp": dictionary.timestamp.isoformat()
        }
        
    except Exception as e:
        logger.error("Error creating new dictionary: %s", e)
        raise HTTPException(status_code=500, detail=f"Failed to create new dictionary: {str(e)}")


@app.post("/dictionary/version/{source_id}", response_model=dict)
@require_write
def create_dictionary_version_handler(source_id: int, user_info: dict = Depends(get_user_info)):
    try:
        # find latest link by timestamp
        existing_link = (
            SourceDictionaryLink
            .select()
            .where(SourceDictionaryLink.source_id == source_id)
            .order_by(SourceDictionaryLink.dictionary_timestamp.desc())
            .first()
        )
        if not existing_link:
            raise HTTPException(status_code=404, detail="No existing dictionary found for this source")

        # fetch original dictionary to get its name (if exists)
        try:
            original_dict = (
                Dictionary
                .select()
                .where(
                    (Dictionary.id == existing_link.dictionary_id) &
                    (Dictionary.timestamp == existing_link.dictionary_timestamp)
                )
                .first()
            )
            original_name = getattr(original_dict, "name", "") if original_dict else f"dictionary-{existing_link.dictionary_id}"
        except Dictionary.DoesNotExist:
            original_name = f"dictionary-{existing_link.dictionary_id}"

        now = datetime.utcnow()

        # create new version (same id, new timestamp)
        dictionary_data = create_new_dictionary_version(
            original_dictionary_id=existing_link.dictionary_id,
            source_id=source_id,
            username=user_info["preferred_username"],
            timestamp=now,
            original_name=original_name
        )

        # create link between source and new version
        create_source_dictionary_link(
            source_id=source_id,
            dictionary_id=dictionary_data["dictionary_id"],
            dictionary_timestamp=datetime.fromisoformat(dictionary_data["dictionary_timestamp"])
        )

        # return id and timestamp of the new version
        return dictionary_data

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error creating dictionary version: %s", e)
        raise HTTPException(status_code=500, detail=f"Failed to create dictionary version: {str(e)}")


####### RULES
@app.get("/rules/by-dictionary", response_model=list[dict])
@require_read
def fetch_rules_by_dictionary(dictionary_id: int, dictionary_timestamp: datetime, user_info: dict = Depends(get_user_info)):
    try:
        rules = get_rules_by_dictionary(dictionary_id, dictionary_timestamp)
        return rules
    except Exception as e:
        logger.error("Error fetching rules by dictionary: %s", e)
        raise HTTPException(status_code=500, detail="Failed to fetch rules")


@app.get("/rules/by-dictionary-all", response_model=list[dict])
@require_read
def fetch_rules_by_dictionary_all(dictionary_id: int, user_info: dict = Depends(get_user_info)):
    try:
        rules = get_rules_by_dictionary_all(dictionary_id)
        return rules
    except Exception as e:
        logger.error("Error fetching rules by dictionary (all): %s", e)
        raise HTTPException(status_code=500, detail="Failed to fetch rules")


@app.post("/rules", response_model=list[dict])
@require_write
async def save_rules(request: Request, user_info: dict = Depends(get_user_info)):
    try:
        data = await request.json()

        rules = data.get("rules", [])
        if not isinstance(rules, list):
            raise HTTPException(status_code=400, detail="Invalid request format - 'rules' must be a list")

        saved_rules = store_rules(rules, user_info["preferred_username"])
        return saved_rules

    except Exception as e:
        logger.error("Error in /rules: %s", e)
        raise HTTPException(status_code=500, detail="Failed to store rules")



