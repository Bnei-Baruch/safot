"""
Shared test fixtures for all backend tests
"""
import pytest
from testcontainers.postgres import PostgresContainer
import peewee as pw
from peewee_migrate import Router
from fastapi.testclient import TestClient
from models import Dictionaries, Rules, Sources, Segments
from server import app, get_user_info


@pytest.fixture(scope="function")
def test_db():
    """
    Setup temporary PostgreSQL database using testcontainers.
    Rebinds all models to test database and runs migrations.
    """
    with PostgresContainer("postgres:16-alpine") as postgres:
        # Create test database connection
        test_database = pw.PostgresqlDatabase(
            postgres.dbname,
            user=postgres.username,
            password=postgres.password,
            host=postgres.get_container_host_ip(),
            port=postgres.get_exposed_port(5432)
        )

        # Store original database references
        models_to_rebind = [Dictionaries, Rules, Sources, Segments]
        original_databases = {model: model._meta.database for model in models_to_rebind}

        try:
            # Bind all models to test database
            test_database.bind(models_to_rebind)

            # Run migrations to set up schema and sequences
            router = Router(test_database, migrate_dir='migrations')
            router.run()

            yield test_database

        finally:
            # Cleanup: close connection
            test_database.close()

            # Restore original database bindings
            for model, original_db in original_databases.items():
                original_db.bind([model])


@pytest.fixture(scope="function")
def client(test_db):
    """
    FastAPI TestClient with mocked authentication.

    Usage:
        def test_something(client):
            response = client.post("/rules", json={"rules": [...]})
            assert response.status_code == 200
    """
    # Mock the get_user_info dependency to bypass Keycloak authentication
    def mock_get_user_info():
        return {
            "preferred_username": "test_user",
            "email": "test@example.com"
        }

    # Override the dependency
    app.dependency_overrides[get_user_info] = mock_get_user_info

    with TestClient(app) as test_client:
        yield test_client

    # Clean up overrides
    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
def clean_tables(test_db):
    """
    Fixture that truncates all tables before each test.
    """
    with test_db.atomic():
        test_db.execute_sql("TRUNCATE dictionaries, rules, sources, segments RESTART IDENTITY CASCADE")
    yield
