import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

PROJECT_ID = "test-proj-documents"


@pytest.fixture
def created_doc(client: TestClient, db: Session) -> dict:
    r = client.post(
        f"/project/{PROJECT_ID}/documents",
        json={"title": "Fixture Doc", "file_path": "/f/fixture.pdf"},
    )
    assert r.status_code == 201
    return r.json()


@pytest.fixture(autouse=True)
def override_auth():
    from src.main import app
    from src.core.security import get_current_user

    app.dependency_overrides[get_current_user] = lambda: "user-999"
    yield
    app.dependency_overrides.pop(get_current_user, None)


# ---------------------------------------------------------------------------
# GET /project/{project_id}/documents
# ---------------------------------------------------------------------------


def test_list_documents_with_existing_doc_returns_200(
    client: TestClient, created_doc: dict
):
    # Arrange — document seeded via fixture

    # Act
    response = client.get(f"/project/{PROJECT_ID}/documents")

    # Assert
    assert response.status_code == 200
    assert any(d["id"] == created_doc["id"] for d in response.json())


# ---------------------------------------------------------------------------
# POST /project/{project_id}/documents
# ---------------------------------------------------------------------------


def test_create_document_valid_payload_returns_201(client: TestClient, db: Session):
    # Arrange
    payload = {"title": "New Doc", "file_path": "/f/new.pdf"}

    # Act
    response = client.post("/project/proj-create/documents", json=payload)

    # Assert
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "New Doc"
    assert data["project_id"] == "proj-create"
    assert data["uploaded_by"] == "user-999"
    assert all(k in data for k in ("id", "created_at", "updated_at"))


def test_create_document_disallowed_extension_returns_422(client: TestClient):
    # Arrange
    payload = {"title": "Bad File", "file_path": "/f/malware.exe"}

    # Act
    response = client.post("/project/proj-create/documents", json=payload)

    # Assert
    assert response.status_code == 422


# ---------------------------------------------------------------------------
# GET /document/{document_id}
# ---------------------------------------------------------------------------


def test_download_document_existing_id_returns_200(
    client: TestClient, created_doc: dict
):
    # Arrange — document seeded via fixture

    # Act
    response = client.get(f"/document/{created_doc['id']}")

    # Assert
    assert response.status_code == 200
    assert b"MOCK FILE CONTENT" in response.content


def test_download_document_content_disposition_exposes_only_basename(
    client: TestClient, db: Session
):
    # Arrange — file_path contains a deep internal path
    r = client.post(
        "/project/proj-dl/documents",
        json={"title": "Path Doc", "file_path": "/internal/secrets/report.pdf"},
    )
    doc_id = r.json()["id"]

    # Act
    response = client.get(f"/document/{doc_id}")

    # Assert — header must contain only the filename, not the full path
    disposition = response.headers["content-disposition"]
    assert "report.pdf" in disposition
    assert "/internal/secrets/" not in disposition


def test_download_document_nonexistent_id_returns_404(client: TestClient):
    # Arrange
    doc_id = "does-not-exist-xyz"

    # Act
    response = client.get(f"/document/{doc_id}")

    # Assert
    assert response.status_code == 404


# ---------------------------------------------------------------------------
# PUT /document/{document_id}
# ---------------------------------------------------------------------------


def test_update_document_valid_title_returns_200(client: TestClient, created_doc: dict):
    # Arrange
    payload = {"title": "Updated Title"}

    # Act
    response = client.put(f"/document/{created_doc['id']}", json=payload)

    # Assert
    assert response.status_code == 200
    assert response.json()["title"] == "Updated Title"


def test_update_document_disallowed_extension_returns_422(
    client: TestClient, created_doc: dict
):
    # Arrange
    payload = {"file_path": "/f/malware.exe"}

    # Act
    response = client.put(f"/document/{created_doc['id']}", json=payload)

    # Assert
    assert response.status_code == 422


def test_update_document_nonexistent_id_returns_404(client: TestClient):
    # Arrange
    payload = {"title": "Ghost Update"}

    # Act
    response = client.put("/document/does-not-exist-xyz", json=payload)

    # Assert
    assert response.status_code == 404


# ---------------------------------------------------------------------------
# DELETE /document/{document_id}
# ---------------------------------------------------------------------------


def test_delete_document_existing_id_returns_204(client: TestClient, created_doc: dict):
    # Arrange — document seeded via fixture

    # Act
    response = client.delete(f"/document/{created_doc['id']}")

    # Assert — 204 and a follow-up GET must confirm removal
    assert response.status_code == 204
    assert client.get(f"/document/{created_doc['id']}").status_code == 404


def test_delete_document_nonexistent_id_returns_404(client: TestClient):
    # Arrange
    doc_id = "does-not-exist-xyz"

    # Act
    response = client.delete(f"/document/{doc_id}")

    # Assert
    assert response.status_code == 404


# ---------------------------------------------------------------------------
# 401 — unauthenticated requests must be rejected on all endpoints
# ---------------------------------------------------------------------------


@pytest.fixture
def no_auth():
    """Remove the autouse auth override so the real JWT validation runs."""
    from src.main import app
    from src.core.security import get_current_user

    app.dependency_overrides.pop(get_current_user, None)
    yield
    # override_auth teardown (autouse) handles any remaining cleanup


def test_list_documents_without_token_returns_401(
    client: TestClient, no_auth
):
    response = client.get(f"/project/{PROJECT_ID}/documents")
    assert response.status_code == 401


def test_download_document_without_token_returns_401(
    client: TestClient, no_auth
):
    response = client.get("/document/any-id")
    assert response.status_code == 401


def test_update_document_without_token_returns_401(
    client: TestClient, no_auth
):
    response = client.put("/document/any-id", json={"title": "x"})
    assert response.status_code == 401


def test_delete_document_without_token_returns_401(
    client: TestClient, no_auth
):
    response = client.delete("/document/any-id")
    assert response.status_code == 401
