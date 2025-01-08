from datetime import datetime
from io import BytesIO
from typing import Union
import os

from peewee import DoesNotExist
from dotenv import load_dotenv
from docx import Document
from fastapi import Depends, FastAPI, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from keycloak import KeycloakOpenID
from playhouse.shortcuts import model_to_dict
from starlette.status import HTTP_401_UNAUTHORIZED

from models import db, Source
# from models import db, Rule, Dictionary

load_dotenv()

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

      # Ensure all tables exist
    db.create_tables([Source], safe=True)


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

# 1. Fetch all sources


@app.get('/sources', response_model=list[dict])
def read_sources(user_info: dict = Depends(get_user_info)):
    sources = list(Source.select().dicts())
    print("Fetched sources:", sources)
    return sources

# 2. Create a new source


@app.post('/sources', response_model=dict)
def create_source(source: dict, user_info: dict = Depends(get_user_info)):
    # Generate a new ID using the database sequence
    cursor = db.execute_sql("SELECT nextval('source_id_seq')")
    id_value = cursor.fetchone()[0]

    # Create the new source record
    created_source = Source.create(
        id=id_value,
        timestamp=datetime.utcnow(),
        # Set the username from authenticated user
        username=user_info['preferred_username'],
        **source  # Unpack additional source fields from the request
    )
    return model_to_dict(created_source)

# 3. Fetch a source by ID


@app.get('/sources/{source_id}', response_model=dict)
def read_source(source_id: int, user_info: dict = Depends(get_user_info)):
    try:
        source = Source.get(Source.id == source_id)
        return model_to_dict(source)
    except DoesNotExist:
        raise HTTPException(status_code=404, detail='Source not found')

# 4. Update an existing source


@app.put('/sources/{source_id}', response_model=dict)
def update_source(source_id: int, source: dict, user_info: dict = Depends(get_user_info)):
    try:
        # Update fields dynamically
        query = Source.update(
            **source, timestamp=datetime.utcnow()).where(Source.id == source_id)
        updated_rows = query.execute()

        if updated_rows == 0:
            raise HTTPException(status_code=404, detail='Source not found')
        # Return the updated object
        db_source = Source.get(Source.id == source_id)
        return model_to_dict(db_source)
    except DoesNotExist:
        raise HTTPException(status_code=404, detail='Source not found')

# 5. Delete a source by ID


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
