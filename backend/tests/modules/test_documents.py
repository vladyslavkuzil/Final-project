import uuid
from pathlib import Path

import pytest
from unittest.mock import Mock, call, patch
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from src.core.enums import MembershipRole
from src.modules.auth.models import User
from src.modules.project_membership.models import ProjectMembership
from src.modules.projects.models import Project

NONEXISTENT_PROJECT_ID = "does-not-exist-project"
NONEXISTENT_DOCUMENT_ID = "does-not-exist-xyz"


def _upload(client, project_id, *, title="Doc", filename="file.pdf", content=b"data"):
    """POST a multipart document upload, matching the real client contract."""
    return client.post(
        f"/project/{project_id}/documents",
        data={"title": title},
        files={"file": (filename, content, "application/octet-stream")},
    )


class InMemoryStorage:
    """Test double for StorageBackend that keeps file bytes in memory."""

    def __init__(self):
        self.files: dict[str, bytes] = {}

    async def save(self, file):
        stored = f"{uuid.uuid4().hex}{Path(file.filename or '').suffix}"
        self.files[stored] = await file.read()
        return stored

    async def get(self, path):
        if path not in self.files:
            raise FileNotFoundError(path)
        yield self.files[path]

    def exists(self, path):
        return path in self.files

    def delete(self, path):
        self.files.pop(path, None)


@pytest.fixture(autouse=True)
def storage_override():
    from src.main import app
    from src.core.storage import get_storage

    storage = InMemoryStorage()
    app.dependency_overrides[get_storage] = lambda: storage
    yield storage
    app.dependency_overrides.pop(get_storage, None)


@pytest.fixture(autouse=True)
def mock_redis():
    with patch("src.modules.projects.services.redis_client") as mock:
        mock.get.return_value = None
        yield mock


@pytest.fixture
def seeded_project(db: Session) -> Project:
    user = User(
        id="user-999",
        email="doctest@example.com",
        hashed_password="x",
        is_active=True,
    )
    db.add(user)
    db.flush()
    project = Project(name="test-project-for-docs", admin_id="user-999")
    project.users.append(user)
    db.add(project)
    db.flush()
    membership = ProjectMembership(
        project_id=project.id, user_id="user-999", role=MembershipRole.OWNER
    )
    db.add(membership)
    db.flush()
    return project


@pytest.fixture
def participant_user(db: Session, seeded_project: Project) -> User:
    user = User(
        id="user-participant",
        email="participant@example.com",
        hashed_password="x",
        is_active=True,
    )
    db.add(user)
    db.flush()
    membership = ProjectMembership(
        project_id=seeded_project.id,
        user_id="user-participant",
        role=MembershipRole.PARTICIPANT,
    )
    db.add(membership)
    db.flush()
    return user


@pytest.fixture
def no_access_user(db: Session) -> User:
    user = User(
        id="user-noaccess",
        email="noaccess@example.com",
        hashed_password="x",
        is_active=True,
    )
    db.add(user)
    db.flush()
    return user


@pytest.fixture
def created_doc(client: TestClient, db: Session, seeded_project: Project) -> dict:
    r = _upload(client, seeded_project.id, title="Fixture Doc", filename="fixture.pdf")
    assert r.status_code == 201
    return r.json()


@pytest.fixture
def auth_as():
    from src.main import app
    from src.core.security import get_current_user

    def _set(user_id: str):
        app.dependency_overrides[get_current_user] = lambda: user_id

    yield _set
    app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture(autouse=True)
def override_auth(auth_as):
    auth_as("user-999")


# ---------------------------------------------------------------------------
# GET /project/{project_id}/documents
# ---------------------------------------------------------------------------


def test_list_documents_with_existing_doc_returns_200(
    client: TestClient, created_doc: dict, seeded_project: Project
):
    # Arrange — document seeded via fixture

    # Act
    response = client.get(f"/project/{seeded_project.id}/documents")

    # Assert
    assert response.status_code == 200
    assert any(d["id"] == created_doc["id"] for d in response.json())


# ---------------------------------------------------------------------------
# POST /project/{project_id}/documents
# ---------------------------------------------------------------------------


def test_create_document_valid_payload_returns_201(
    client: TestClient, db: Session, seeded_project: Project
):
    # Act
    response = _upload(client, seeded_project.id, title="New Doc", filename="new.pdf")

    # Assert
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "New Doc"
    assert data["project_id"] == seeded_project.id
    assert data["uploaded_by"] == "user-999"
    assert all(k in data for k in ("id", "created_at", "updated_at"))


def test_create_document_disallowed_extension_returns_400(
    client: TestClient, seeded_project: Project
):
    # Act
    response = _upload(
        client, seeded_project.id, title="Bad File", filename="malware.exe"
    )

    # Assert
    assert response.status_code == 400


# ---------------------------------------------------------------------------
# GET /project/{project_id}/documents/{document_id}
# ---------------------------------------------------------------------------


def test_download_document_existing_id_returns_real_bytes(
    client: TestClient, db: Session, seeded_project: Project
):
    # Arrange — upload a document with known content
    r = _upload(
        client,
        seeded_project.id,
        title="Report",
        filename="report.pdf",
        content=b"hello world pdf",
    )
    doc_id = r.json()["id"]

    # Act
    response = client.get(f"/project/{seeded_project.id}/documents/{doc_id}")

    # Assert — the real stored bytes are streamed back
    assert response.status_code == 200
    assert response.content == b"hello world pdf"


def test_download_document_disposition_uses_title_not_stored_path(
    client: TestClient, db: Session, seeded_project: Project
):
    # Arrange — the stored path is an opaque key; the title drives the filename
    r = _upload(client, seeded_project.id, title="report.pdf", filename="report.pdf")
    doc_id = r.json()["id"]
    stored_path = r.json()["file_path"]

    # Act
    response = client.get(f"/project/{seeded_project.id}/documents/{doc_id}")

    # Assert — header exposes the title-based filename, never the stored key
    disposition = response.headers["content-disposition"]
    assert "report.pdf" in disposition
    assert stored_path not in disposition


def test_download_document_nonexistent_id_returns_404(
    client: TestClient, seeded_project: Project
):
    # Arrange
    doc_id = NONEXISTENT_DOCUMENT_ID

    # Act
    response = client.get(f"/project/{seeded_project.id}/documents/{doc_id}")

    # Assert
    assert response.status_code == 404


def test_download_document_missing_file_returns_404(
    client: TestClient, seeded_project: Project, storage_override
):
    # Arrange — a document whose stored file has gone missing (e.g. volume reset)
    r = _upload(client, seeded_project.id, title="Gone", filename="gone.pdf")
    doc_id = r.json()["id"]
    storage_override.delete(r.json()["file_path"])

    # Act
    response = client.get(f"/project/{seeded_project.id}/documents/{doc_id}")

    # Assert — a clean 404, not a broken 200 stream
    assert response.status_code == 404


# ---------------------------------------------------------------------------
# PUT /project/{project_id}/documents/{document_id}
# ---------------------------------------------------------------------------


def test_update_document_valid_title_returns_200(
    client: TestClient, created_doc: dict, seeded_project: Project
):
    # Arrange
    payload = {"title": "Updated Title"}

    # Act
    response = client.put(
        f"/project/{seeded_project.id}/documents/{created_doc['id']}", json=payload
    )

    # Assert
    assert response.status_code == 200
    assert response.json()["title"] == "Updated Title"


def test_update_document_disallowed_extension_returns_422(
    client: TestClient, created_doc: dict, seeded_project: Project
):
    # Arrange
    payload = {"file_path": "/f/malware.exe"}

    # Act
    response = client.put(
        f"/project/{seeded_project.id}/documents/{created_doc['id']}", json=payload
    )

    # Assert
    assert response.status_code == 422


def test_update_document_nonexistent_id_returns_404(
    client: TestClient, seeded_project: Project
):
    # Arrange
    payload = {"title": "Ghost Update"}

    # Act
    response = client.put(
        f"/project/{seeded_project.id}/documents/{NONEXISTENT_DOCUMENT_ID}",
        json=payload,
    )

    # Assert
    assert response.status_code == 404


# ---------------------------------------------------------------------------
# DELETE /project/{project_id}/documents/{document_id}
# ---------------------------------------------------------------------------


def test_delete_document_existing_id_returns_204(
    client: TestClient, created_doc: dict, seeded_project: Project
):
    # Arrange — document seeded via fixture

    # Act
    response = client.delete(
        f"/project/{seeded_project.id}/documents/{created_doc['id']}"
    )

    # Assert — 204 and a follow-up GET must confirm removal
    assert response.status_code == 204
    assert (
        client.get(
            f"/project/{seeded_project.id}/documents/{created_doc['id']}"
        ).status_code
        == 404
    )


def test_delete_document_nonexistent_id_returns_404(
    client: TestClient, seeded_project: Project
):
    # Arrange
    doc_id = NONEXISTENT_DOCUMENT_ID

    # Act
    response = client.delete(f"/project/{seeded_project.id}/documents/{doc_id}")

    # Assert
    assert response.status_code == 404


def test_delete_document_unlinks_file_only_after_commit():
    # Arrange — the stored file must be removed strictly after the DB commit.
    from src.modules.documents import services

    db = Mock()
    storage = Mock()
    doc = Mock()
    doc.file_path = "stored.pdf"
    # Record commit and delete on a shared parent so their relative order is visible.
    manager = Mock()
    manager.attach_mock(db.commit, "commit")
    manager.attach_mock(storage.delete, "storage_delete")

    # Act
    with patch.object(services, "get_document", return_value=doc):
        result = services.delete_document(db, storage, "doc-1", "proj-1")

    # Assert — committed, then unlinked, in that order (with the right key)
    assert result is True
    assert manager.mock_calls == [call.commit(), call.storage_delete("stored.pdf")]


def test_delete_document_keeps_file_when_commit_fails():
    # Arrange — commit blows up after the row delete is staged.
    from src.modules.documents import services

    db = Mock()
    db.commit.side_effect = RuntimeError("boom")
    storage = Mock()
    doc = Mock()
    doc.file_path = "stored.pdf"

    # Act / Assert — the error propagates, the file is NOT removed, and we roll back.
    with patch.object(services, "get_document", return_value=doc):
        with pytest.raises(RuntimeError):
            services.delete_document(db, storage, "doc-1", "proj-1")

    db.rollback.assert_called_once()
    storage.delete.assert_not_called()


# ---------------------------------------------------------------------------
# 401 — unauthenticated requests must be rejected on all endpoints
# ---------------------------------------------------------------------------


@pytest.fixture
def no_auth(override_auth):
    from src.main import app
    from src.core.security import get_current_user

    app.dependency_overrides.pop(get_current_user, None)
    yield


def test_list_documents_without_token_returns_401(client: TestClient, no_auth):
    # Arrange — auth override removed via no_auth fixture

    # Act
    response = client.get(f"/project/{NONEXISTENT_PROJECT_ID}/documents")

    # Assert
    assert response.status_code == 401


def test_download_document_without_token_returns_401(
    client: TestClient, no_auth, seeded_project: Project
):
    # Arrange — auth override removed via no_auth fixture

    # Act
    response = client.get(f"/project/{seeded_project.id}/documents/any-id")

    # Assert
    assert response.status_code == 401


def test_update_document_without_token_returns_401(
    client: TestClient, no_auth, seeded_project: Project
):
    # Arrange — auth override removed via no_auth fixture

    # Act
    response = client.put(
        f"/project/{seeded_project.id}/documents/any-id", json={"title": "x"}
    )

    # Assert
    assert response.status_code == 401


def test_delete_document_without_token_returns_401(
    client: TestClient, no_auth, seeded_project: Project
):
    # Arrange — auth override removed via no_auth fixture

    # Act
    response = client.delete(f"/project/{seeded_project.id}/documents/any-id")

    # Assert
    assert response.status_code == 401


def test_upload_document_without_token_returns_401(
    client: TestClient, no_auth, seeded_project: Project
):
    # Arrange — auth override removed via no_auth fixture

    # Act
    response = _upload(client, seeded_project.id)

    # Assert
    assert response.status_code == 401


# ---------------------------------------------------------------------------
# 404 — nonexistent project_id must be rejected on project-scoped endpoints
# ---------------------------------------------------------------------------


def test_list_documents_nonexistent_project_returns_404(client: TestClient):
    # Arrange — no project with this ID exists

    # Act
    response = client.get(f"/project/{NONEXISTENT_PROJECT_ID}/documents")

    # Assert
    assert response.status_code == 404


def test_upload_document_nonexistent_project_returns_404(client: TestClient):
    # Act
    response = _upload(client, NONEXISTENT_PROJECT_ID)

    # Assert
    assert response.status_code == 404


def test_download_document_nonexistent_project_returns_404(client: TestClient):
    # Arrange — new path added by require_role() on this endpoint

    # Act
    response = client.get(
        f"/project/{NONEXISTENT_PROJECT_ID}/documents/{NONEXISTENT_DOCUMENT_ID}"
    )

    # Assert
    assert response.status_code == 404


def test_update_document_nonexistent_project_returns_404(client: TestClient):
    # Act
    response = client.put(
        f"/project/{NONEXISTENT_PROJECT_ID}/documents/{NONEXISTENT_DOCUMENT_ID}",
        json={"title": "x"},
    )

    # Assert
    assert response.status_code == 404


def test_delete_document_nonexistent_project_returns_404(client: TestClient):
    # Act
    response = client.delete(
        f"/project/{NONEXISTENT_PROJECT_ID}/documents/{NONEXISTENT_DOCUMENT_ID}"
    )

    # Assert
    assert response.status_code == 404


# ---------------------------------------------------------------------------
# Role-based access — 403 for users with no project membership
# ---------------------------------------------------------------------------


@pytest.fixture
def as_no_access(auth_as, no_access_user: User):
    auth_as(no_access_user.id)


def test_no_access_user_cannot_list_documents(
    client: TestClient, seeded_project: Project, as_no_access
):
    # Arrange — user has no membership in the project

    # Act
    response = client.get(f"/project/{seeded_project.id}/documents")

    # Assert
    assert response.status_code == 403


def test_no_access_user_cannot_upload_document(
    client: TestClient, seeded_project: Project, as_no_access
):
    # Act
    response = _upload(client, seeded_project.id)

    # Assert
    assert response.status_code == 403


def test_no_access_user_cannot_download_document(
    client: TestClient, created_doc: dict, seeded_project: Project, as_no_access
):
    # Arrange — document seeded by owner via fixture

    # Act
    response = client.get(f"/project/{seeded_project.id}/documents/{created_doc['id']}")

    # Assert
    assert response.status_code == 403


def test_no_access_user_cannot_update_document(
    client: TestClient, created_doc: dict, seeded_project: Project, as_no_access
):
    # Arrange
    payload = {"title": "Hijack"}

    # Act
    response = client.put(
        f"/project/{seeded_project.id}/documents/{created_doc['id']}",
        json=payload,
    )

    # Assert
    assert response.status_code == 403


def test_no_access_user_cannot_delete_document(
    client: TestClient, created_doc: dict, seeded_project: Project, as_no_access
):
    # Arrange — document seeded by owner via fixture

    # Act
    response = client.delete(
        f"/project/{seeded_project.id}/documents/{created_doc['id']}"
    )

    # Assert
    assert response.status_code == 403


# ---------------------------------------------------------------------------
# Role-based access — participant can read and modify, but not delete
# ---------------------------------------------------------------------------


@pytest.fixture
def as_participant(auth_as, participant_user: User):
    auth_as(participant_user.id)


def test_participant_can_list_documents(
    client: TestClient, seeded_project: Project, as_participant
):
    # Arrange — participant membership seeded via fixture

    # Act
    response = client.get(f"/project/{seeded_project.id}/documents")

    # Assert
    assert response.status_code == 200


def test_participant_can_upload_document(
    client: TestClient, seeded_project: Project, as_participant
):
    # Act
    response = _upload(client, seeded_project.id, title="Participant Doc")

    # Assert
    assert response.status_code == 201


def test_participant_can_download_document(
    client: TestClient, created_doc: dict, seeded_project: Project, as_participant
):
    # Arrange — document seeded by owner via fixture

    # Act
    response = client.get(f"/project/{seeded_project.id}/documents/{created_doc['id']}")

    # Assert
    assert response.status_code == 200


def test_participant_can_update_document(
    client: TestClient, created_doc: dict, seeded_project: Project, as_participant
):
    # Arrange
    payload = {"title": "Participant Edit"}

    # Act
    response = client.put(
        f"/project/{seeded_project.id}/documents/{created_doc['id']}",
        json=payload,
    )

    # Assert
    assert response.status_code == 200


def test_participant_cannot_delete_document(
    client: TestClient, created_doc: dict, seeded_project: Project, as_participant
):
    # Arrange — document seeded by owner via fixture

    # Act
    response = client.delete(
        f"/project/{seeded_project.id}/documents/{created_doc['id']}"
    )

    # Assert
    assert response.status_code == 403


# ---------------------------------------------------------------------------
# Cascade delete — removing a project must remove its documents
# ---------------------------------------------------------------------------


def test_delete_project_removes_its_documents(
    client: TestClient, created_doc: dict, seeded_project: Project
):
    # Arrange — document exists and is reachable
    doc_id = created_doc["id"]
    assert (
        client.get(f"/project/{seeded_project.id}/documents/{doc_id}").status_code
        == 200
    )

    # Act — delete the parent project
    response = client.delete(f"/project/{seeded_project.id}")
    assert response.status_code == 200

    # Assert — document is gone, no orphan remains
    assert (
        client.get(f"/project/{seeded_project.id}/documents/{doc_id}").status_code
        == 404
    )
