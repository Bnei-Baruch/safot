from datetime import datetime
from io import BytesIO
from typing import Union
import os
import logging
import json

from peewee import DoesNotExist
from dotenv import load_dotenv
from docx import Document
from fastapi import Depends, FastAPI, HTTPException, Request, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from keycloak import KeycloakOpenID
from playhouse.shortcuts import model_to_dict
from starlette.status import HTTP_401_UNAUTHORIZED

from services.translation_service import TranslationService
from services.segment_service import save_segments_from_file, create_segment, update_segment, get_latest_segments
from models import Source, Segment, SegmentsFetchRequest, Language, TranslationServiceOptions
from db import db


# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger('peewee')
logger.setLevel(logging.DEBUG)

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
print('Initializing keycloak', os.getenv('KEYCLOAK_SERVER_URL'),
      os.getenv('KEYCLOAK_CLIENT_ID'), os.getenv('KEYCLOAK_REALM_NAME'))
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
        print('Invalid or expired token:', e)
        raise HTTPException(status_code=HTTP_401_UNAUTHORIZED,
                            detail='Invalid or expired token')


@app.on_event('startup')
def startup():
    if db.is_closed():
        db.connect()
        db.create_tables([Source, Segment], safe=True)
    logger.info('Database connected and tables ensured')


@app.on_event('shutdown')
def shutdown():
    if not db.is_closed():
        db.close()
    logger.info('Database connection closed')


@app.post('/docx2text')
def docx2text(file: UploadFile, _: dict = Depends(get_user_info)):
    ret = []
    content = file.file.read()
    print('content: ')
    print(content)
    document = Document(BytesIO(content))
    for p in document.paragraphs:
        ret.append(p.text)
    return ret


@app.post('/segments/save')
async def save_segments_handler(
    request: Request,
    file: UploadFile = None,
    source_id: str = Form(None),
    properties: str = Form(None),
    user_info: dict = Depends(get_user_info)
):
    try:
        if file:  # uploadfile
            if not source_id:
                raise HTTPException(
                    status_code=400, detail="Missing source_id for file upload")

            properties_dict = json.loads(properties) if properties else {}
            return save_segments_from_file(file, int(source_id), properties_dict, user_info)

        json_data = await request.json()
        properties_dict = json_data.get("properties", {})
        segment_type = properties_dict.get("segment_type", "")

        if segment_type == "provider_translation":
            return process_translation(json_data, user_info)

        # update or create segment
        if "id" in json_data and json_data["id"]:
            return update_segment(json_data, user_info)
        else:
            return create_segment(json_data, user_info)

    except Exception as e:
        print(f"❌ Error in /segments/save: {e}")
        raise HTTPException(
            status_code=500, detail=f"Error processing request: {str(e)}")


@app.get('/segments/{source_id}', response_model=list[dict])
def read_sources(source_id: int, user_info: dict = Depends(get_user_info)):

    try:
        latest_segments = get_latest_segments(source_id)
        return latest_segments

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to fetch segments: {str(e)}")


@app.post("/segments/translate", response_model=dict)
def get_segments_for_translation(
    request: SegmentsFetchRequest, user_info: dict = Depends(get_user_info)
):
    source_id = request.source_id
    original_source_id = request.original_source_id
    target_language = request.target_language
    source_language = request.source_language

    print(f"Translating segments from {source_language} to {target_language}")

    try:

        original_segments = list(Segment.select().where(
            Segment.source_id == original_source_id).dicts())
        existing_translations_orders = {
            seg.order for seg in Segment.select().where(Segment.source_id == source_id)}
        segments_to_translate = [
            seg for seg in original_segments if seg["order"] not in existing_translations_orders]

        if segments_to_translate:
            options = TranslationServiceOptions(
                source_language=source_language,
                target_language=target_language
            )

            translation_service = TranslationService(
                api_key=OPENAI_API_KEY,
                options=options
            )

            translation_service.process_translation(
                segments_to_translate, source_id, user_info['preferred_username'])

        # Fetch the latest segments for each `order`
        latest_translated_segments = get_latest_segments(source_id)

        return {
            "message": "Translation completed",
            "total_segments_translated": len(latest_translated_segments),
            "translated_segments": list(latest_translated_segments.values())
        }

    except Exception as e:
        print(f"Error starting translation: {e}")
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")


@app.get('/sources', response_model=list[dict])
def read_sources(user_info: dict = Depends(get_user_info)):
    sources = list(Source.select().dicts())
    print("Fetched sources:", sources)
    return sources


@app.post('/sources', response_model=dict)
def create_source(source: dict, user_info: dict = Depends(get_user_info)):
    # Generate a new ID using the database sequence
    cursor = db.execute_sql("SELECT nextval('source_id_seq')")
    id_value = cursor.fetchone()[0]

    created_source = Source.create(
        id=id_value,
        username=user_info['preferred_username'],
        **source  # Unpack additional source fields from the request
    )
    return model_to_dict(created_source)


@app.get('/sources/{source_id}', response_model=dict)
def read_source(source_id: int, user_info: dict = Depends(get_user_info)):
    try:
        source = Source.get(Source.id == source_id)
        return model_to_dict(source)
    except DoesNotExist:
        raise HTTPException(status_code=404, detail='Source not found')


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

############################################################################################################################


@app.post('/dictionaries', response_model=dict)
def create_dictionary(dictionary: dict, user_info: dict = Depends(get_user_info)):
    print('User info:', user_info)
    new_dictionary = Dictionary(**dictionary)

    cursor = db.execute_sql("SELECT nextval('dictionary_id_seq')")
    id_value = cursor.fetchone()[0]

    return model_to_dict(Dictionary.create(
        id=id_value,
        name=new_dictionary.name,
        username=user_info['preferred_username'],
        labels=new_dictionary.labels,
    ))


@app.get('/dictionaries', response_model=list[dict])
def read_dictionaries(skip: int = 0, limit: int = 10, user_info: dict = Depends(get_user_info)):
    return list(Dictionary.select().offset(skip).limit(limit).dicts())


@app.get('/dictionaries/{dictionary_id}', response_model=dict)
def read_dictionary(dictionary_id: int, user_info: dict = Depends(get_user_info)):
    try:
        return model_to_dict(Dictionary.get(Dictionary.id == dictionary_id))
    except DoesNotExist:
        raise HTTPException(status_code=404, detail='Dictionary not found')


@app.put('/dictionaries/{dictionary_id}', response_model=dict)
def update_dictionary(dictionary_id: int, dictionary: dict, user_info: dict = Depends(get_user_info)):
    try:
        updated_dictionary = Dictionary(**dictionary)
        db_dictionary = Dictionary.get(Dictionary.id == dictionary_id)
        db_dictionary.name = updated_dictionary.name
        db_dictionary.username = user_info['preferred_username']
        db_dictionary.labels = updated_dictionary.labels
        db_dictionary.timestamp = datetime.utcnow()
        # We don't update we create a new row with new timestamp.
        return model_to_dict(Dictionary.create(**model_to_dict(db_dictionary)))
    except DoesNotExist:
        raise HTTPException(status_code=404, detail='Dictionary not found')


@app.delete('/dictionaries/{dictionary_id}', response_model=int)
def delete_dictionary(dictionary_id: int, _: dict = Depends(get_user_info)):
    return Dictionary.delete().where(Dictionary.id == dictionary_id).execute()
