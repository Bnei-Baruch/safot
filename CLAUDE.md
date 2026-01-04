# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Safot is a document translation application that uses OpenAI's API or other AI-powered API for translation. It consists of a React frontend and a FastAPI backend, with PostgreSQL for persistence. The application supports uploading documents (.docx), translating them with customizable prompts/dictionaries, and exporting translated versions.

## Architecture

### Backend (Python/FastAPI)
- **Framework**: FastAPI with Peewee ORM
- **Database**: PostgreSQL with version-controlled data model (composite primary keys with timestamps)
- **Authentication**: Keycloak integration via JWT tokens
- **Translation**: OpenAI API integration with chunking strategy for large documents. Other API should be added soon. The architecture planned to support multiple versions.

#### Key Backend Components

**Data Model (versioned):**
- `Sources`: Documents with language metadata. Each translation creates a new source linked via `original_source_id`
- `Segments`: Paragraphs/text chunks with composite PK `(id, timestamp)` for versioning
- `Dictionaries`: Translation rule sets with composite PK `(id, timestamp)`
- `Rules`: Individual translation rules belonging to dictionaries with composite PK `(id, timestamp)`

The versioning pattern allows tracking changes over time - when updating a dictionary or rule, a new row is inserted with the same ID but a new timestamp.

**Services:**
- `translation_service.py`: OpenAI integration with token-based chunking using " ||| " as paragraph separator
- `segment_service.py`: Document parsing (DOCX) and segment management
- `source_service.py`: Source CRUD operations
- `dictionary.py`: Dictionary/rule management
- `prompt.py`: Builds prompts from dictionary rules for translation

**API Endpoints:**
- `/sources`: CRUD for documents
- `/segments/{source_id}`: Get/save text segments (latest versions only)
- `/translate`: Translate paragraphs using OpenAI
- `/docx2text`: Extract paragraphs from uploaded DOCX
- `/export/{source_id}`: Generate translated DOCX
- `/dictionaries`, `/rules`: Manage translation dictionaries and rules
- `/prompt`: Build prompt text from dictionary or use default prompts

**Authentication:**
All endpoints require Keycloak JWT token in `Authorization: Bearer <token>` header. User info is extracted and stored with created/modified records.

### Frontend (React/TypeScript)
- **Framework**: React 18 with TypeScript
- **State Management**: Redux Toolkit
- **Routing**: React Router v6
- **UI**: Material-UI (MUI) v6
- **Authentication**: Keycloak via @react-keycloak/web

#### Key Frontend Components

**Pages:**
- `Main.tsx`: Landing page with source list
- `SourceEdit.tsx`: Translation editor with split view

**Services:**
- `http.service.ts`: Axios wrapper with token interceptor (10 min timeout for translations)
- `source.service.ts`, `segment.service.ts`, `translation.service.ts`, `dictionary.service.ts`: API calls

**State Management (Redux):**
- `SourceSlice.ts`: Sources state
- `SegmentSlice.ts`: Segments state
- `DictionarySlice.ts`: Dictionaries/rules state

**Main Flow (`useFlow.ts`):**
The `useFlow` hook orchestrates the translation workflow:
1. `translateFile()`: Upload DOCX → create sources → extract paragraphs → translate → save segments
2. `translateSegments()`: Takes segments → builds prompt → calls OpenAI → saves translated segments
3. `createDefaultDict()`: Creates a dictionary with default prompt template

## Development Commands

### Backend

```bash
cd backend

# Install dependencies
pip install "fastapi[standard]"
pip install python-docx

# Run development server
fastapi dev server.py --port=7392 --host=0.0.0.0

# Run tests
python -m pytest test_provider_tools.py
```

**Environment Variables (.env):**
Required: `PG_DATABASE`, `PG_USER`, `PG_PASSWORD`, `PG_HOST`, `PG_PORT`, `KEYCLOAK_SERVER_URL`, `KEYCLOAK_CLIENT_ID`, `KEYCLOAK_REALM_NAME`, `OPENAI_API_KEY`

**Database Migrations:**
Migrations are in `backend/migrations/` and run automatically on startup via peewee-migrate. To create a new migration, use the peewee-migrate CLI.

### Frontend

```bash
cd frontend

# Install dependencies
yarn install

# Run development server (custom port)
PORT=1234 yarn start

# Build for production
yarn build

# Run tests
yarn test
```

**Environment Variables:**
Set `REACT_APP_BACKEND_URL` to point to the backend API endpoint.

## Important Technical Details

### Translation Flow
1. Documents are split into paragraphs (segments) and stored separately from sources
2. Translation prompts can come from:
   - Custom dictionaries (collection of rules) attached to a source
   - Default prompt templates (e.g., "prompt_1") with language placeholders
3. OpenAI API receives chunks of segments joined by " ||| " and returns translations separated the same way
4. Token limits are calculated based on model context window, prompt size, and expected output ratio (1.2x)
5. Segments maintain links to original segments via `original_segment_id` and `original_segment_timestamp`

### Data Versioning
When editing dictionaries or rules, the backend creates new versions with the same ID but updated timestamp. The frontend queries either:
- Latest version (no timestamp specified)
- Specific version (timestamp provided)

Sources can be linked to specific dictionary versions via `dictionary_id` and `dictionary_timestamp`.

### Segment Queries
When fetching segments, the API uses a subquery to get only the latest version of each segment ID for a given source. This is handled in the `/segments/{source_id}` endpoint using Peewee's join with a subquery on `MAX(timestamp)`.

## Deployment

Both frontend and backend have GitHub Actions workflows (`.github/workflows/`) for building Docker images and deploying to production via SSH. Deployments are manually triggered via `workflow_dispatch`.
