from datetime import datetime
from db import db
from docx import Document
from dotenv import load_dotenv
from keycloak import KeycloakOpenID
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
from services.segment_service import (
    get_paragraphs_from_file, 
    get_latest_segments, 
    store_segments, 
    store_temporal_segments,
    build_segments_from_paragraphs,
    build_additional_sources_segments,
    prepare_segments_for_storage,
    update_temporal_segments_remaining_text,
    create_segment_origin_links
)
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

from models import (
    Dictionaries,
    ParagraphsTranslateRequest,
    PromptRequest,
    Rules,
    Segments,
    SegmentsOrigins,
    Sources,
    SourcesOrigins,
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
def read_sources(metadata: bool = Query(False), user_info: dict = Depends(get_user_info)):
    return get_sources(metadata)

@app.get('/sources/{source_id}', response_model=dict)
def read_source(source_id: int, metadata: bool = Query(False), user_info: dict = Depends(get_user_info)):
    sources = get_sources(metadata, source_id)
    if not len(sources):
        raise HTTPException(status_code=404, detail='Source not found')
    if len(sources) > 1:
        raise HTTPException(status_code=500, detail='Expected only one source for source_id: ' + str(source_id))
    return sources[0]

@app.post('/sources', response_model=dict)
def create_or_update_source_handler(source: dict, user_info: dict = Depends(get_user_info)):
    return create_or_update_sources([source], user_info['preferred_username'])

@app.delete('/sources/{translation_source_id}', response_model=list)
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
        source_ids_to_delete.append(source.original_source_id)

    # Find all additional sources linked via SourcesOrigins
    additional_source_ids = [link.origin_source_id for link in SourcesOrigins.select().where(
        SourcesOrigins.translated_source_id == translation_source_id
    )]
    source_ids_to_delete.extend(additional_source_ids)
    source_ids_to_delete = list(dict.fromkeys(source_ids_to_delete))

    # Get segment IDs
    segment_ids = [seg.id for seg in Segments.select(Segments.id).where(
        Segments.source_id.in_(source_ids_to_delete)
    )]

    # Delete by IDs
    if segment_ids:
        SegmentsOrigins.delete().where(
            (SegmentsOrigins.origin_segment_id.in_(segment_ids)) |
            (SegmentsOrigins.translated_segment_id.in_(segment_ids))
        ).execute()
    SourcesOrigins.delete().where(
        (SourcesOrigins.origin_source_id.in_(source_ids_to_delete)) |
        (SourcesOrigins.translated_source_id.in_(source_ids_to_delete))
    ).execute()
    Segments.delete().where(Segments.source_id.in_(source_ids_to_delete)).execute()
    Sources.delete().where(Sources.id.in_(source_ids_to_delete)).execute()
    return source_ids_to_delete

@app.post('/sources/origins', response_model=list[dict])
async def create_source_origin_links(request: Request, user_info: dict = Depends(get_user_info)):
    try:
        data = await request.json()
        original_source_id = data.get("original_source_id")
        other_source_ids = data.get("other_source_ids", [])
        translated_source_id = data.get("translated_source_id")

        if original_source_id is None or translated_source_id is None:
            raise HTTPException(status_code=400, detail="original_source_id and translated_source_id are required")

        if not isinstance(other_source_ids, list):
            raise HTTPException(status_code=400, detail="other_source_ids must be a list")

        # Create links: original source + all other sources -> translated source
        all_origin_ids = [original_source_id] + other_source_ids
        created_links = []

        for source_id in all_origin_ids:
            # Get next sequence value for id
            cursor = db.execute_sql("SELECT nextval('sources_origins_id_seq')")
            link_id = cursor.fetchone()[0]

            # Create the link
            sources_origins = SourcesOrigins.create(
                id=link_id,
                origin_source_id=source_id,
                translated_source_id=translated_source_id,
            )
            created_links.append(model_to_dict(sources_origins))

        logger.info(f"Created {len(created_links)} source origin links: {all_origin_ids} -> {translated_source_id}")
        return created_links
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error creating source origin links: %s", e)
        raise HTTPException(status_code=500, detail=f"Failed to create source origin links: {str(e)}")

####### SEGMENTS 
@app.get('/segments/{source_id}', response_model=list)
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
async def save_segments(request: Request, user_info: dict = Depends(get_user_info)):
    try:
        data = await request.json()
        now = datetime.utcnow()
        username = user_info["preferred_username"]
        
        # New format: build segments from paragraphs
        if "paragraphs" in data:
            paragraphs = data.get("paragraphs", [])
            source_id = data.get("source_id")
            properties = data.get("properties", {})
            original_segments = data.get("originalSegments", [])
            additional_sources_segments = data.get("additional_sources_segments", {})
            
            segments = build_segments_from_paragraphs(
                paragraphs, source_id, properties, username, now, original_segments
            )
            
            if additional_sources_segments:
                segments.extend(build_additional_sources_segments(
                    additional_sources_segments, properties, username, now
                ))
                # Update temporal segments (order=0) by removing consumed text
                update_temporal_segments_remaining_text(
                    additional_sources_segments, username, now
                )
        else:
            # Old format: segments already built
            segments = data.get("segments", [])
            prepare_segments_for_storage(segments, username, now)
            original_segments = None
            additional_sources_segments = None
        
        saved_segments = store_segments(segments)
        
        # Create segment origin links after segments are saved
        if "paragraphs" in data:
            create_segment_origin_links(
                saved_segments,
                source_id,
                original_segments,
                additional_sources_segments
            )
        
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
        
        if not request.prompt_text or not request.prompt_text.strip():
            raise HTTPException(status_code=400, detail="Missing prompt_text in request.")

        translation_service = TranslationService(
            api_key=OPENAI_API_KEY,
            options=TranslationServiceOptions(),  # Allow setting options via request.
            prompt_text=request.prompt_text
        )

        additional_sources = None
        if request.additionalSourcesText:
            additional_sources = [{"text": source.text, "language": source.language, "source_id": source.source_id} for source in request.additionalSourcesText]

        translated_paragraphs, additional_sources_segments, properties = translation_service.translate_paragraphs(
            request.paragraphs,
            additional_sources=additional_sources
        )
        end_time = datetime.utcnow()
        total_duration = (end_time - start_time).total_seconds()
        logger.info("Total translation time: %.2f seconds for %d paragraphs", total_duration, len(request.paragraphs))

        return {
            "translated_paragraphs": translated_paragraphs,
            "additional_sources_segments": additional_sources_segments,
            "properties": properties,
            "total_segments_translated": len(translated_paragraphs),
            "translation_time_seconds": total_duration
        }

    except Exception as e:
        logger.error("Error in translation handler: %s", e)
        raise HTTPException(status_code=500, detail=f"Translation failed: {str(e)}")
    
####### IMPORT/EXPORT
@app.post('/docx2text')
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

@app.post('/extractText')
async def extract_text_handler(request: Request, user_info: dict = Depends(get_user_info)):
    try:
        form = await request.form()
        files = form.getlist("files")
        additional_sources_str = form.get("additional_sources")
        
        if not files:
            raise HTTPException(status_code=400, detail="No files provided")
        
        # Parse additional_sources if provided (contains name and id)
        additional_sources = []
        source_ids = []
        if additional_sources_str:
            import json
            additional_sources = json.loads(additional_sources_str)
            source_ids = [source.get("id") for source in additional_sources if source.get("id") is not None]
            if len(source_ids) != len(files):
                raise HTTPException(status_code=400, detail="Number of source_ids must match number of files")
        
        results = []
        
        for i, file_item in enumerate(files):
            if not hasattr(file_item, 'filename') or not file_item.filename:
                continue
                
            if not file_item.filename.lower().endswith('.docx'):
                raise HTTPException(status_code=400, detail=f"Only .docx files are supported. File: {file_item.filename}")
            
            paragraphs = get_paragraphs_from_file(file_item)
            # Join all paragraphs into a single string
            text = "\n\n".join(paragraphs)
            properties = {"segment_type": "file"}
            
            results.append({
                "source_id": source_ids[i],
                "text": text,
                "properties": properties
            })
    
        store_temporal_segments(results, user_info['preferred_username'], datetime.utcnow())
        logger.info(f"Stored {len(source_ids)} temporal segments with order=0")
        
        return results
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error in /extractText: %s", e)
        raise HTTPException(status_code=500, detail=f"Failed to extract text: {str(e)}")
    
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


####### DICTIONARY, RULES, PROMPT.
@app.post("/prompt", response_model=str)
async def get_prompt(request: PromptRequest, dict = Depends(get_user_info)):
    if request.dictionary_id is None and not request.prompt_key:
        raise HTTPException(status_code=400, detail=f"Either dictionary_id or prompt_key should be set.")
    try:
        if request.prompt_key:
            return build_custom_prompt(
                request.prompt_key,
                request.original_language,
                request.translated_language,
                num_additional_sources=request.num_additional_sources)
        else:
            return build_prompt(
                request.dictionary_id,
                request.dictionary_timestamp,
                num_additional_sources=request.num_additional_sources)
    except Exception as e:
        logger.error("Error getting prompt: %s", e)
        raise HTTPException(status_code=500, detail=f"Failed to get prompt: {str(e)}")

@app.get("/dictionaries", response_model=list[dict])
async def read_dictionaries(dictionary_id: int | None = None, dictionary_timestamp: int | None = None, user_info: dict = Depends(get_user_info)):
	return get_dictionaries(dictionary_id, dictionary_timestamp)

@app.post("/dictionaries", response_model=dict)
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
		logger.info('d %s %s', dictionary, type(dictionary)) 
		logger.info('before %s %s', updated_dictionary, type(updated_dictionary)) 
		apply_dict(updated_dictionary, dictionary, logger)
		logger.info('after %s %s', updated_dictionary, type(updated_dictionary)) 
		updated_dictionary.save(force_insert=True)

	return get_dictionaries(updated_dictionary.id, epoch_microseconds(updated_dictionary.timestamp))[0]

@app.post("/dictionaries/prompt", response_model=dict)
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
def fetch_rules(dictionary_id: int | None = None, dictionary_timestamp: int | None = None, user_info: dict = Depends(get_user_info)):
	return get_rules(dictionary_id, dictionary_timestamp)


@app.post("/rules", response_model=dict)
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
