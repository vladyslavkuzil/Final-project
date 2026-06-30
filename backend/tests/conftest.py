import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from src.core.database import engine, get_db
from src.main import app


@pytest.fixture(autouse=True)
def mock_redis():
    with patch("src.modules.projects.services.redis_client") as mock:
        mock.get.return_value = None
        yield mock


@pytest.fixture(scope="module")
def client() -> TestClient:
    with TestClient(app) as c:
        yield c


@pytest.fixture
def db() -> Session:
    """
    Wraps every test in an outer DB transaction that is always rolled back.

    The session uses join_transaction_mode="create_savepoint" so that any
    session.commit() called inside application code issues a SAVEPOINT /
    RELEASE SAVEPOINT instead of a real commit.  The outer connection-level
    transaction is never committed, meaning no rows ever persist between tests.

    This fixture also overrides the FastAPI get_db dependency so the
    application code and the test share the exact same session object.
    """
    connection = engine.connect()
    outer_txn = connection.begin()
    session = Session(bind=connection, join_transaction_mode="create_savepoint")

    app.dependency_overrides[get_db] = lambda: session

    yield session

    app.dependency_overrides.pop(get_db, None)
    session.close()
    outer_txn.rollback()
    connection.close()
