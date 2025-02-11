from datetime import datetime
from io import BytesIO
from typing import Union
import os

from peewee import DoesNotExist
from dotenv import load_dotenv
from docx import Document
from fastapi import Depends, FastAPI, HTTPException, Request, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from keycloak import KeycloakOpenID
from playhouse.shortcuts import model_to_dict
from starlette.status import HTTP_401_UNAUTHORIZED

from services.translation_service import TranslationService

from models import db, Source, Segment, SegmentsFetchRequest

load_dotenv()

app = FastAPI()
translation_service = TranslationService()

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

      # Ensure all tables exist
    db.create_tables([Source, Segment], safe=True)


@app.on_event('shutdown')
def shutdown():
    if not db.is_closed():
        db.close()


@app.get('/')
def read_root():
    return {'Hello': 'World'}


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


@app.post('/segments', response_model=dict)
def add_segments_from_file(
    file: UploadFile,
    source_id: str = Form(...),
    user_info: dict = Depends(get_user_info)
):
    try:
        source_id = int(source_id)
        content = file.file.read()
        document = Document(BytesIO(content))
        paragraphs = [p.text for p in document.paragraphs if p.text.strip()]

        segments = []
        now = datetime.utcnow()
        for order, text in enumerate(paragraphs):
            segment = Segment.create(
                timestamp=now,
                username=user_info['preferred_username'],
                text=text,
                source_id=source_id,
                order=order,
                properties={}
            )
            print(f"Saved segment: {model_to_dict(segment)}")
            segments.append(model_to_dict(segment))

        return {"source_id": source_id}

    except ValueError as e:
        raise HTTPException(
            status_code=400, detail=f"Invalid source_id format: {str(e)} ")
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to process file: {str(e)}")


@app.get('/segments/{source_id}', response_model=list[dict])
def read_sources(source_id: int, user_info: dict = Depends(get_user_info)):
    segments = list(Segment.select().where(
        Segment.source_id == source_id).dicts())
    print("Fetched segments:", segments)
    return segments


@app.post('/segments/addSegment', response_model=dict)
def add_segment(segment: dict, user_info: dict = Depends(get_user_info)):
    try:
        print(f"Received segment data: {segment}")
        new_segment = Segment.create(
            timestamp=datetime.utcnow(),
            username=user_info['preferred_username'],
            text=segment['text'],
            source_id=segment['source_id'],
            order=segment['order'],
            original_segment_id=segment.get('original_segment_id'),
            original_segment_timestamp=segment.get(
                'original_segment_timestamp'),
            properties={}
        )
        print(f"Saved segment: {model_to_dict(new_segment)}")
        return model_to_dict(new_segment)

    except Exception as e:
        print(f"Error saving segment: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to add segment: {str(e)}")


@app.post("/segments/translate", response_model=dict)
def get_segments_for_translation(
    request: SegmentsFetchRequest, user_info: dict = Depends(get_user_info)
):
    source_id = request.source_id
    original_source_id = request.original_source_id
    language = request.language
    source_language = request.source_language

    try:

        original_segments = list(Segment.select().where(
            Segment.source_id == original_source_id).dicts())
        existing_translations_orders = {
            seg.order for seg in Segment.select().where(Segment.source_id == source_id)}
        segments_to_translate = [
            seg for seg in original_segments if seg["order"] not in existing_translations_orders]

        # If there are segments that need translation, send them to OpenAI
        if segments_to_translate:
            translation_service = TranslationService(
                source_language=source_language,
                target_language=language)
            translation_service.process_translation(
                segments_to_translate, source_id, user_info['preferred_username'])

        # Fetch **only** the latest segments for each `order`
        latest_translated_segments = {}
        translated_segments = list(Segment.select()
                                   .where(Segment.source_id == source_id)
                                   .order_by(Segment.order, Segment.timestamp.desc())
                                   .dicts())

        for seg in translated_segments:
            if seg["order"] not in latest_translated_segments:
                latest_translated_segments[seg["order"]] = seg
        # return the latest translated segments
        return {
            "message": "Translation completed",
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
