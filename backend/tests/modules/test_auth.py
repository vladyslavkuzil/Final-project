import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from src.modules.auth.security import (
    get_password_hash,
    verify_password,
    create_access_token,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

TEST_EMAIL = "test@example.com"
TEST_PASSWORD = "strongpassword123"


@pytest.fixture
def registered_user(client: TestClient, db: Session) -> dict:
    """Register a user and return the response body."""
    r = client.post(
        "/auth/register",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
    )
    assert r.status_code == 200
    return r.json()


# ---------------------------------------------------------------------------
# Unit tests — security utilities
# ---------------------------------------------------------------------------


class TestPasswordHashing:
    def test_hash_and_verify_correct_password(self):
        hashed = get_password_hash("my_secret")
        assert verify_password("my_secret", hashed) is True

    def test_verify_wrong_password_returns_false(self):
        hashed = get_password_hash("my_secret")
        assert verify_password("wrong_password", hashed) is False

    def test_hash_is_not_plaintext(self):
        hashed = get_password_hash("my_secret")
        assert hashed != "my_secret"


class TestCreateAccessToken:
    def test_returns_non_empty_string(self):
        token = create_access_token(data={"sub": "user-1"})
        assert isinstance(token, str)
        assert len(token) > 0

    def test_different_data_produces_different_tokens(self):
        t1 = create_access_token(data={"sub": "user-1"})
        t2 = create_access_token(data={"sub": "user-2"})
        assert t1 != t2


# ---------------------------------------------------------------------------
# POST /auth/register
# ---------------------------------------------------------------------------


class TestRegister:
    def test_register_valid_user_returns_200(self, client: TestClient, db: Session):
        # Arrange
        payload = {"email": "newuser@example.com", "password": "securepass"}

        # Act
        response = client.post("/auth/register", json=payload)

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "newuser@example.com"
        assert data["is_active"] is True
        assert "id" in data
        # Password must never leak in the response
        assert "password" not in data
        assert "hashed_password" not in data

    def test_register_duplicate_email_returns_400(
        self, client: TestClient, registered_user: dict, db: Session
    ):
        # Arrange — user already registered via fixture

        # Act — try to register with the same email
        response = client.post(
            "/auth/register",
            json={"email": TEST_EMAIL, "password": "anotherpass"},
        )

        # Assert
        assert response.status_code == 400
        assert "already registered" in response.json()["detail"].lower()

    def test_register_invalid_email_returns_422(self, client: TestClient, db: Session):
        # Arrange
        payload = {"email": "not-an-email", "password": "securepass"}

        # Act
        response = client.post("/auth/register", json=payload)

        # Assert
        assert response.status_code == 422

    def test_register_missing_password_returns_422(
        self, client: TestClient, db: Session
    ):
        # Arrange
        payload = {"email": "valid@example.com"}

        # Act
        response = client.post("/auth/register", json=payload)

        # Assert
        assert response.status_code == 422


# ---------------------------------------------------------------------------
# POST /auth/login
# ---------------------------------------------------------------------------


class TestLogin:
    def test_login_valid_credentials_returns_token(
        self, client: TestClient, registered_user: dict, db: Session
    ):
        # Arrange — user registered via fixture

        # Act
        response = client.post(
            "/auth/login",
            data={"username": TEST_EMAIL, "password": TEST_PASSWORD},
        )

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert len(data["access_token"]) > 0

    def test_login_wrong_password_returns_401(
        self, client: TestClient, registered_user: dict, db: Session
    ):
        # Arrange — user registered via fixture

        # Act
        response = client.post(
            "/auth/login",
            data={"username": TEST_EMAIL, "password": "wrongpassword"},
        )

        # Assert
        assert response.status_code == 401

    def test_login_nonexistent_user_returns_401(self, client: TestClient, db: Session):
        # Arrange — no user with this email

        # Act
        response = client.post(
            "/auth/login",
            data={"username": "ghost@example.com", "password": "any"},
        )

        # Assert
        assert response.status_code == 401

    def test_login_missing_fields_returns_422(self, client: TestClient, db: Session):
        # Arrange — empty form data

        # Act
        response = client.post("/auth/login", data={})

        # Assert
        assert response.status_code == 422
