"""
Document service layer.

Handles all CRUD operations for project documents.
"""

import uuid
from sqlalchemy.orm import Session
from src.core.storage import StorageBackend
from src.core.cache import redis_client
from src.core.image_keys import resized_key
from src.modules.documents.models import Document
from src.modules.projects.models import Project
from src.modules.project_membership.models import ProjectMembership


def _invalidate_project_caches(db: Session, project_id: str) -> None:
    user_ids = (
        db.query(ProjectMembership.user_id)
        .filter(ProjectMembership.project_id == project_id)
        .all()
    )
    for (uid,) in user_ids:
        redis_client.delete(f"user:{uid}:projects")


def get_documents_by_project(db: Session, project_id: str) -> list[Document]:
    """Return all documents that belong to the given project.

    Args:
        db: Active SQLAlchemy session.
        project_id: Identifier of the parent project.

    Returns:
        A (possibly empty) list of Document ORM instances.
    """
    return db.query(Document).filter(Document.project_id == project_id).all()


def get_document(db: Session, document_id: str, project_id: str) -> Document | None:
    # project_id scope prevents fetching a document via an unrelated project's URL.
    return (
        db.query(Document)
        .filter(Document.id == document_id, Document.project_id == project_id)
        .first()
    )


def create_document(
    db: Session,
    project_id: str,
    title: str,
    file_path: str,
    user_id: str,
    file_size: int = 0,
) -> Document:
    """Insert a new document row and return it refreshed from the database.

    Args:
        db: Active SQLAlchemy session.
        project_id: Identifier of the project this document belongs to.
        title: Human-readable document title.
        file_path: Storage path or URI of the uploaded file.
        user_id: Identifier of the user performing the upload.
        file_size: Size of the uploaded file in bytes.

    Returns:
        The newly created Document, refreshed from the database.

    Raises:
        Exception: Re-raises any database error after rolling back the
            transaction to leave the session in a clean state.
    """
    doc = Document(
        id=str(uuid.uuid4()),
        title=title,
        file_path=file_path,
        project_id=project_id,
        uploaded_by=user_id,
        size_bytes=file_size,
    )
    try:
        db.add(doc)
        project = db.query(Project).filter(Project.id == project_id).one_or_none()
        if project is not None:
            project.documents_count += 1
            project.total_size_bytes += file_size
        db.commit()
    except Exception:
        db.rollback()
        raise
    _invalidate_project_caches(db, project_id)
    db.refresh(doc)
    return doc


def update_document(
    db: Session,
    document_id: str,
    project_id: str,
    title: str | None,
    file_path: str | None,
) -> Document | None:
    # project_id scope prevents cross-project modifications. None fields are left unchanged.
    doc = get_document(db, document_id, project_id)
    if not doc:
        return None
    if title is not None:
        doc.title = title
    if file_path is not None:
        doc.file_path = file_path
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise
    db.refresh(doc)
    return doc


def delete_document(
    db: Session, storage: StorageBackend, document_id: str, project_id: str
) -> bool:
    doc = get_document(db, document_id, project_id)
    if not doc:
        return False
    file_path = doc.file_path
    file_size = doc.size_bytes
    try:
        db.delete(doc)
        project = db.query(Project).filter(Project.id == project_id).one_or_none()
        if project is not None:
            project.documents_count = max(0, project.documents_count - 1)
            project.total_size_bytes = max(0, project.total_size_bytes - file_size)
        db.commit()
    except Exception:
        db.rollback()
        raise
    _invalidate_project_caches(db, project_id)
    # Remove the stored file(s) only after the row is durably gone, so a
    # commit failure can't orphan a live document whose bytes have already been deleted.
    storage.delete(file_path)
    resized = resized_key(file_path)
    if resized and storage.exists(resized):
        storage.delete(resized)
    return True
