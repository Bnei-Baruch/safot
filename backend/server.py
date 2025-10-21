from datetime import datetime
from db import db
from docx import Document
from dotenv import load_dotenv
import logging
import os

from peewee import (
    SQL,
    JOIN,
    fn,
)
from peewee_migrate import Router
from playhouse.shortcuts import model_to_dict
from starlette.status import HTTP_401_UNAUTHORIZED

from fastapi import (
    Depends,
    FastAPI,
    File,
    Form,
    HTTPException,
    Query,
    Request,
    UploadFile,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from services.translation_service import TranslationService
from services.segment_service import get_paragraphs_from_file, get_latest_segments, store_segments
from services.source_service import (
    create_or_update_sources,
    get_sources,
)
from services.dictionary import (
    get_dictionaries,
    get_rules,
)
from services.prompt import (
    build_custom_prompt,
    build_prompt,
    SEGMENTS_SUFFIX,
    RULE_TYPE_TEXT,
    RULE_TYPE_SEGMENTS_SUFFIX,
)
from services.utils import (
    apply_dict,
    epoch_microseconds,
    microseconds,
)
from services.user_service import UserManagementService
from services.auth import (
    get_user_info,
    require_admin,
    require_read,
    require_write,
)

from models import (
    Dictionaries,
    ParagraphsTranslateRequest,
    PromptRequest,
    Rules,
    Segments,
    Sources,
    TranslationServiceOptions,
)

def configure_logging():
    """Configure logging for the entire application"""
    logging.basicConfig(
        level=logging.DEBUG,
        format='%(asctime)s - %(name)s - %(levelname)s - [%(filename)s:%(lineno)d] - %(message)s'
    )
    # Configure peewee logger
    peewee_logger = logging.getLogger('peewee')
    peewee_logger.setLevel(logging.DEBUG)

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

@app.on_event('startup')
def startup():
    if db.is_closed():
        db.connect()
    
    router = Router(db, migrate_dir='migrations')
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
def read_sources(metadata: bool = Query(False), user_info: dict = Depends(get_user_info)):
    return get_sources(metadata)

@app.get('/sources/{source_id}', response_model=dict)
@require_read
def read_source(source_id: int, metadata: bool = Query(False), user_info: dict = Depends(get_user_info)):
    sources = get_sources(metadata, source_id)
    if not len(sources):
        raise HTTPException(status_code=404, detail='Source not found')
    if len(sources) > 1:
        raise HTTPException(status_code=500, detail='Expected only one source for source_id: ' + str(source_id))
    return sources[0]

@app.post('/sources', response_model=dict)
@require_write
def create_or_update_source_handler(source: dict, user_info: dict = Depends(get_user_info)):
    return create_or_update_sources([source], user_info['preferred_username'])

@app.delete('/sources/{translation_source_id}', response_model=list)
@require_write
def delete_source(translation_source_id: int, _: dict = Depends(get_user_info)):
    try:
        source = Sources.get(Sources.id == translation_source_id)
    except Exception as e:
        logger.error(f"Deletion - Source not found: {e}")
        raise HTTPException(status_code=404, detail='Source not found')

    # Get all translations of the original source
    translations = list(Sources.select().where(Sources.original_source_id == source.original_source_id))
    source_ids_to_delete = [translation_source_id]
    if len(translations) == 1:
        # This is the last translation, allow deletion of both translation and original
        source_ids_to_delete.append(source.original_source_id)

    # Delete all segments for these sources
    Segments.delete().where(Segments.source_id.in_(source_ids_to_delete)).execute()
    # Delete the sources themselves
    Sources.delete().where(Sources.id.in_(source_ids_to_delete)).execute()
    return source_ids_to_delete

####### SEGMENTS 
@app.get('/segments/{source_id}', response_model=list)
@require_read
def read_segments(source_id: int, user_info: dict = Depends(get_user_info)):
    try:
        # Sub query to get latest segments.
        subquery = (Segments
            .select(Segments.id, fn.MAX(Segments.timestamp).alias('latest_timestamp'))
            .where(Segments.source_id == source_id)
            .group_by(Segments.id))
        # Get all latest segments
        query = (Segments
            .select(
                Segments,
                microseconds(Segments.timestamp, 'timestamp_epoch'),
            )
            .where(Segments.source_id == source_id)
            .join(subquery, on=(
                (Segments.id == subquery.c.id) &
                (Segments.timestamp == subquery.c.latest_timestamp)
            ))
            .order_by(Segments.order))

        return list(query.dicts())
        
    except Exception as e:
        logger.error("Error fetching segments: %s", e)
        raise HTTPException(
            status_code=500, detail=f"Failed to fetch segments: {str(e)}")

# TODO: Refactor segments to have _epoch fields and created_/modified_ fields..
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

        translation_service = TranslationService(
            api_key=OPENAI_API_KEY,
            options=TranslationServiceOptions(),  # Allow setting options via request.
            prompt_text=request.prompt_text
        )

        translated_paragraphs, properties = translation_service.translate_paragraphs(request.paragraphs)
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
@require_read
def extract_segments_handler(file: UploadFile = File(...)):
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


####### DICTIONARY, RULES, PROMPT.
@app.post("/prompt", response_model=str)
@require_read
async def get_prompt(request: PromptRequest, dict = Depends(get_user_info)):
    if request.dictionary_id is None and not request.prompt_key:
        raise HTTPException(status_code=400, detail=f"Either dictionary_id or prompt_key should be set.")
    try:
        if request.prompt_key:
            return build_custom_prompt(
                request.prompt_key,
                request.original_language,
                request.translated_language)
        else:
            return build_prompt(request.dictionary_id, request.dictionary_timestamp)
    except Exception as e:
        logger.error("Error getting prompt: %s", e)
        raise HTTPException(status_code=500, detail=f"Failed to get prompt: {str(e)}")

@app.get("/dictionaries", response_model=list[dict])
@require_read
async def read_dictionaries(dictionary_id: int | None = None, dictionary_timestamp: int | None = None, user_info: dict = Depends(get_user_info)):
    return get_dictionaries(dictionary_id, dictionary_timestamp)

@app.post("/dictionaries", response_model=dict)
@require_write
async def post_dictionary(dictionary: dict, user_info: dict = Depends(get_user_info)):
    username = user_info["preferred_username"]
    now = datetime.utcnow()
    if not "id" in dictionary or not dictionary["id"]:
        cursor = db.execute_sql("SELECT nextval('dictionary_id_seq')")
        dictionary_id = cursor.fetchone()[0]

        updated_dictionary = Dictionaries.create(
            id=dictionary_id,
            username=username,
            timestamp=now,
            **dictionary,
        ) 
    else:
        updated_dictionary = (Dictionaries
            .select()
            .where(Dictionaries.id == dictionary["id"])
            .order_by(Dictionaries.timestamp.desc())
            .limit(1)
            .get_or_none())
        if updated_dictionary is None:
            raise HTTPException(status_code=404, detail="Dictionary not found")
        updated_dictionary.username = username
        updated_dictionary.timestamp = now
        logger.info('dictionary timestamp %s %s', dictionary["timestamp"], type(dictionary["timestamp"])) 
        apply_dict(updated_dictionary, dictionary)
        logger.info('d %s %s', dictionary, type(dictionary)) 
        logger.info('before %s %s', updated_dictionary, type(updated_dictionary)) 
        apply_dict(updated_dictionary, dictionary, logger)
        logger.info('after %s %s', updated_dictionary, type(updated_dictionary)) 
        updated_dictionary.save(force_insert=True)

    return get_dictionaries(updated_dictionary.id, epoch_microseconds(updated_dictionary.timestamp))[0]

@app.post("/dictionaries/prompt", response_model=dict)
@require_write
async def create_prompt_dictionary(request: dict, user_info: dict = Depends(get_user_info)):
    try:
        name = request.get("name", None)
        prompt_key = request.get("prompt_key", None)
        original_language = request.get("original_language", None)
        translated_language = request.get("translated_language", None)

        timestamp=datetime.utcnow()

        cursor = db.execute_sql("SELECT nextval('dictionary_id_seq')")
        dictionary_id = cursor.fetchone()[0]

        created_dictionary = Dictionaries.create(
            id=dictionary_id,
            timestamp=timestamp,
            username=user_info['preferred_username'],
            name=name,
        )

        if prompt_key:
            if not original_language or not translated_language:
                raise HTTPException(status_code=404, detail='When prompt_key set, original_language and translated_language must be set')
                
            cursor = db.execute_sql("SELECT nextval('rule_id_seq')")
            rule_id = cursor.fetchone()[0]

            prompt_rule = Rules.create(
                id=rule_id,
                timestamp=timestamp,
                name="Default prompt " + prompt_key,
                username=user_info['preferred_username'],
                dictionary_id=dictionary_id,
                order=0,
                type=RULE_TYPE_TEXT,
                properties={"text": build_custom_prompt(prompt_key, original_language, translated_language, with_segments_suffix=False)},
            )

            cursor = db.execute_sql("SELECT nextval('rule_id_seq')")
            rule_id = cursor.fetchone()[0]

            segments_rule = Rules.create(
                id=rule_id,
                timestamp=timestamp,
                name="Segments suffix rule.",
                username=user_info['preferred_username'],
                dictionary_id=dictionary_id,
                order=1,
                type=RULE_TYPE_SEGMENTS_SUFFIX,
                properties={"text": SEGMENTS_SUFFIX},
            )

        return model_to_dict(created_dictionary) 
    except Exception as e:
        logger.error("Error adding or creating new dictionary: %s", e)
        raise HTTPException(status_code=500, detail=f"Failed adding or creating new dictionary: {str(e)}")


@app.get("/rules", response_model=list[dict])
@require_read
def fetch_rules(dictionary_id: int | None = None, dictionary_timestamp: int | None = None, user_info: dict = Depends(get_user_info)):
    return get_rules(dictionary_id, dictionary_timestamp)


@app.post("/rules", response_model=dict)
@require_write
async def post_rules(rule: dict, user_info: dict = Depends(get_user_info)):
    username = user_info["preferred_username"]
    now = datetime.utcnow()
    if not "id" in rule or not rule["id"]:
        cursor = db.execute_sql("SELECT nextval('rule_id_seq')")
        rule_id = cursor.fetchone()[0]

        updated_rule = Rules.create(
            id=rule_id,
            username=username,
            timestamp=now,
            **rule,
        ) 
    else:
        updated_rule = (Rules
            .select()
            .where(Rules.id == rule["id"])
            .order_by(Rules.timestamp.desc())
            .limit(1)
            .get_or_none())
        if updated_rule is None:
            raise HTTPException(status_code=404, detail="Rule not found")
        updated_rule.username = username
        updated_rule.timestamp = now
        apply_dict(updated_rule, rule)
        updated_rule.save(force_insert=True)

    return get_rules(rule_id=updated_rule.id)[0]

####### USER MANAGEMENT
# Initialize user management service
user_service = UserManagementService()

@app.get('/users', response_model=list[dict])
@require_admin
def get_all_users(search: str = None, user_info: dict = Depends(get_user_info)):
    """Get all users with their roles - Admin only"""
    try:
        logger.info(f"Search parameter received: '{search}'")
        users = user_service.get_all_users(search)
        logger.info(f"Found {len(users)} users")
        return users
    except Exception as e:
        logger.error(f"Error fetching users: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch users")

@app.get('/roles', response_model=list[str])
@require_admin
def get_available_roles(user_info: dict = Depends(get_user_info)):
    """Get all available roles - Admin only"""
    try:
        roles = user_service.get_available_roles()
        return roles
    except Exception as e:
        logger.error(f"Error fetching roles: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch roles")

@app.put('/users/{user_id}/roles', response_model=dict)
@require_admin
async def update_user_roles(user_id: str, request: Request, user_info: dict = Depends(get_user_info)):
    """Update user roles - Admin only"""
    try:
        # Get the raw request body
        body = await request.body()
        logger.info(f"Raw request body: {body}")

        # Try to parse as JSON
        import json
        try:
            data = json.loads(body)
            logger.info(f"Parsed JSON data: {data}")
            roles = data.get('roles', [])
            logger.info(f"Extracted roles: {roles}")
        except json.JSONDecodeError as e:
            logger.error(f"JSON decode error: {e}")
            raise HTTPException(status_code=400, detail="Invalid JSON in request body")

        # Check if user is trying to remove their own admin role
        current_user_id = user_info.get('sub')
        if current_user_id == user_id:
            # Get current user's roles
            current_user_roles = user_service.get_user_roles(current_user_id)
            current_role_names = [role['name'] for role in current_user_roles]

            # Check if user currently has admin role
            has_admin_role = any('admin' in role_name.lower() for role_name in current_role_names)

            if has_admin_role:
                # Check if they're trying to remove admin role
                new_role_names = [role['name'] for role in roles if isinstance(role, dict)] + [role for role in roles if isinstance(role, str)]
                will_have_admin_role = any('admin' in role_name.lower() for role_name in new_role_names)

                if not will_have_admin_role:
                    raise HTTPException(status_code=403, detail="You cannot remove your own admin role")

        success = user_service.update_user_roles(user_id, roles)
        if success:
            return {"message": "User roles updated successfully", "user_id": user_id, "roles": roles}
        else:
            raise HTTPException(status_code=500, detail="Failed to update user roles")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating user roles for {user_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update user roles: {str(e)}")

