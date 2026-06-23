import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from src.modules.auth.security import (
    get_password_hash,
    verify_password,
    create_access_token,
    create_refresh_token,
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


# ---------------------------------------------------------------------------
# Unit tests — create_refresh_token
# ---------------------------------------------------------------------------


class TestCreateRefreshToken:
    def test_returns_non_empty_string(self):
        token = create_refresh_token(data={"sub": "user-1"})
        assert isinstance(token, str)
        assert len(token) > 0

    def test_refresh_token_differs_from_access_token(self):
        access = create_access_token(data={"sub": "user-1"})
        refresh = create_refresh_token(data={"sub": "user-1"})
        assert access != refresh

    def test_different_data_produces_different_tokens(self):
        t1 = create_refresh_token(data={"sub": "user-1"})
        t2 = create_refresh_token(data={"sub": "user-2"})
        assert t1 != t2


# ---------------------------------------------------------------------------
# POST /auth/refresh
# ---------------------------------------------------------------------------


class TestRefresh:
    def test_refresh_with_valid_token_returns_new_pair(
        self, client: TestClient, registered_user: dict, db: Session
    ):
        # Arrange — login to get a refresh token
        login_response = client.post(
            "/auth/login",
            data={"username": TEST_EMAIL, "password": TEST_PASSWORD},
        )
        refresh_token = login_response.json()["refresh_token"]

        # Act
        response = client.post(
            "/auth/refresh",
            json={"refresh_token": refresh_token},
        )

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"
        assert len(data["access_token"]) > 0
        assert len(data["refresh_token"]) > 0

    def test_refresh_returns_different_tokens_than_original(
        self, client: TestClient, registered_user: dict, db: Session
    ):
        # Arrange
        login_response = client.post(
            "/auth/login",
            data={"username": TEST_EMAIL, "password": TEST_PASSWORD},
        )
        original = login_response.json()

        # Act
        response = client.post(
            "/auth/refresh",
            json={"refresh_token": original["refresh_token"]},
        )

        # Assert — new tokens should differ from the originals
        data = response.json()
        assert data["access_token"] != original["access_token"]

    def test_refresh_with_access_token_returns_401(
        self, client: TestClient, registered_user: dict, db: Session
    ):
        # Arrange — get an ACCESS token (not refresh)
        login_response = client.post(
            "/auth/login",
            data={"username": TEST_EMAIL, "password": TEST_PASSWORD},
        )
        access_token = login_response.json()["access_token"]

        # Act — try to use the access token as a refresh token
        response = client.post(
            "/auth/refresh",
            json={"refresh_token": access_token},
        )

        # Assert
        assert response.status_code == 401

    def test_refresh_with_garbage_token_returns_401(
        self, client: TestClient, db: Session
    ):
        # Arrange
        garbage = "this.is.not.a.valid.jwt"

        # Act
        response = client.post(
            "/auth/refresh",
            json={"refresh_token": garbage},
        )

        # Assert
        assert response.status_code == 401

    def test_refresh_with_empty_body_returns_422(self, client: TestClient, db: Session):
        # Arrange / Act
        response = client.post("/auth/refresh", json={})

        # Assert
        assert response.status_code == 422
