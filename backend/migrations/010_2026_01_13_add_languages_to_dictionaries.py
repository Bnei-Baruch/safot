"""
Add language columns to dictionaries table to support multi-language translation.
Adds original_language, additional_sources_languages (array), and translated_language.
Extracts language data from existing rules with text properties.
"""

def migrate(migrator, database, fake=False, **kwargs):
    # Add original_language column
    database.execute_sql(
        "ALTER TABLE dictionaries ADD COLUMN IF NOT EXISTS original_language VARCHAR(255);"
    )

    # Add additional_sources_languages array column
    database.execute_sql(
        "ALTER TABLE dictionaries ADD COLUMN IF NOT EXISTS additional_sources_languages VARCHAR(255)[];"
    )

    # Add translated_language column
    database.execute_sql(
        "ALTER TABLE dictionaries ADD COLUMN IF NOT EXISTS translated_language VARCHAR(255);"
    )

    # Extract language data from existing rules using PostgreSQL regex
    # This updates dictionaries based on text patterns like "from English to Hebrew"
    # Use raw string to avoid Python string escaping issues
    # Note: %% is used to escape % in LIKE clause for psycopg parameter placeholders
    sql = r"""
        UPDATE dictionaries d
        SET
            original_language = CASE
                WHEN r.text ~* 'from\s+English\s+(?:in)?to' THEN 'en'
                WHEN r.text ~* 'from\s+French\s+(?:in)?to' THEN 'fr'
                WHEN r.text ~* 'from\s+Hebrew\s+(?:in)?to' THEN 'he'
                WHEN r.text ~* 'from\s+Arabic\s+(?:in)?to' THEN 'ar'
                WHEN r.text ~* 'from\s+Spanish\s+(?:in)?to' THEN 'es'
                WHEN r.text ~* 'from\s+Russian\s+(?:in)?to' THEN 'ru'
                WHEN r.text ~* 'from\s+Ukrainian\s+(?:in)?to' THEN 'uk'
                WHEN r.text ~* 'from\s+Turkish\s+(?:in)?to' THEN 'tr'
                WHEN r.text ~* 'from\s+German\s+(?:in)?to' THEN 'de'
                WHEN r.text ~* 'from\s+Italian\s+(?:in)?to' THEN 'it'
            END,
            translated_language = CASE
                WHEN r.text ~* '(?:in)?to\s+English' THEN 'en'
                WHEN r.text ~* '(?:in)?to\s+French' THEN 'fr'
                WHEN r.text ~* '(?:in)?to\s+Hebrew' THEN 'he'
                WHEN r.text ~* '(?:in)?to\s+Arabic' THEN 'ar'
                WHEN r.text ~* '(?:in)?to\s+Spanish' THEN 'es'
                WHEN r.text ~* '(?:in)?to\s+Russian' THEN 'ru'
                WHEN r.text ~* '(?:in)?to\s+Ukrainian' THEN 'uk'
                WHEN r.text ~* '(?:in)?to\s+Turkish' THEN 'tr'
                WHEN r.text ~* '(?:in)?to\s+German' THEN 'de'
                WHEN r.text ~* '(?:in)?to\s+Italian' THEN 'it'
            END
        FROM (
            SELECT DISTINCT ON (dictionary_id)
                dictionary_id,
                properties->>'text' as text
            FROM rules
            WHERE properties->>'text' IS NOT NULL
                AND properties->>'text' LIKE '%%from%%to%%'
            ORDER BY dictionary_id, timestamp DESC
        ) r
        WHERE d.id = r.dictionary_id
            AND r.text IS NOT NULL;
    """
    database.execute_sql(sql)

def rollback(migrator, database, fake=False, **kwargs):
    # Remove columns in reverse order
    database.execute_sql("ALTER TABLE dictionaries DROP COLUMN IF EXISTS translated_language;")
    database.execute_sql("ALTER TABLE dictionaries DROP COLUMN IF EXISTS additional_sources_languages;")
    database.execute_sql("ALTER TABLE dictionaries DROP COLUMN IF EXISTS original_language;")
