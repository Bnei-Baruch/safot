from datetime import datetime
import os
import logging

from peewee import DoesNotExist
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
from services.rule_service import store_rules, create_initial_prompt_rule
from services.dictionary_service import create_new_dictionary, create_new_dictionary_version, create_source_dictionary_link
from services.source_service import create_source
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
def read_sources(user_info: dict = Depends(get_user_info)):
    sources = list(Source.select().dicts())
    return sources

@app.get('/sources/{source_id}', response_model=dict)
def read_source(source_id: int, user_info: dict = Depends(get_user_info)):
    try:
        source = Source.get(Source.id == source_id)
        return model_to_dict(source)
    except DoesNotExist:
        raise HTTPException(status_code=404, detail='Source not found')

@app.post('/sources', response_model=dict)
def create_source_handler(source: dict, user_info: dict = Depends(get_user_info)):
    return create_source(source, user_info['preferred_username'])

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

@app.delete('/sources/{source_id}', response_model=int)
def delete_source(source_id: int, _: dict = Depends(get_user_info)):
    rows_deleted = Source.delete().where(Source.id == source_id).execute()
    if rows_deleted == 0:
        raise HTTPException(status_code=404, detail='Source not found')
    return rows_deleted

####### SEGMENTS 
@app.get('/segments/{source_id}', response_model=dict)
def read_segments(source_id: int, offset: int = 0, limit: int = 100, user_info: dict = Depends(get_user_info)):
    try:
        # Get total count for pagination info
        total_count = Segment.select().where(Segment.source_id == source_id).count()
        
        # Get paginated segments
        segments = list(Segment.select()
                       .where(Segment.source_id == source_id)
                       .order_by(Segment.order)
                       .offset(offset)
                       .limit(limit)
                       .dicts())
        
        return {
            "segments": segments,
            "pagination": {
                "offset": offset,
                "limit": limit,
                "total_count": total_count,
                "has_more": offset + limit < total_count
            }
        }

    except Exception as e:
        logger.error("Error fetching segments: %s", e)
        raise HTTPException(
            status_code=500, detail=f"Failed to fetch segments: {str(e)}")

@app.post('/segments', response_model=list[dict])
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
def translate_paragraphs_handler(
    request: ParagraphsTranslateRequest,
    user_info: dict = Depends(get_user_info)
):
    try:
        start_time = datetime.utcnow()

        if not request.paragraphs:
            raise HTTPException(status_code=400, detail="No paragraphs provided.")
        
        prompt_key = "prompt_2" if (request.examples and len(request.examples) > 0) else "prompt_1"

        options = TranslationServiceOptions(
            source_language=request.source_language,
            target_language=request.target_language,
            prompt_key=prompt_key 
        )

        translation_service = TranslationService(
            api_key=OPENAI_API_KEY,
            options=options,
            examples=request.examples  
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
def extract_segments_handler(
    file: UploadFile = File(...),
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
def export_translation(source_id: int):

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
@app.post("/dictionary/{source_id}", response_model=dict)
def create_dictionary_or_version_for_source(source_id: int, user_info: dict = Depends(get_user_info)):
    try:
        existing_link = (
            SourceDictionaryLink
            .select()
            .where(SourceDictionaryLink.source_id == source_id)
            .order_by(SourceDictionaryLink.dictionary_timestamp.desc())
            .first()
        )

        now = datetime.utcnow()

        if existing_link:
            dictionary = create_new_dictionary_version(
                existing_link.dictionary_id,
                source_id,
                user_info["preferred_username"],
                now
            )
        else:
            dictionary = create_new_dictionary(
                source_id,
                user_info["preferred_username"],
                now
            )
            create_initial_prompt_rule(
                dictionary.id,
                dictionary.timestamp,
                user_info["preferred_username"]
            )

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
        logger.error("Error: %s", e)
        raise HTTPException(status_code=500, detail=f"Failed to create dictionary/version: {str(e)}")

####### RULES
@app.post("/rules", response_model=list[dict])
async def save_rules(request: Request, user_info: dict = Depends(get_user_info)):
    try:
        data = await request.json()

        rules = data.get("rules", [])
        if not isinstance(rules, list):
            raise HTTPException(status_code=400, detail="Invalid request format - 'rules' must be a list")

        now = datetime.utcnow()
        for rule in rules:
            rule["username"] = user_info["preferred_username"]
            rule["timestamp"] = now

        saved_rules = store_rules(rules)
        return saved_rules

    except Exception as e:
        logger.error("Error in /rules: %s", e)
        raise HTTPException(status_code=500, detail="Failed to store rules")



