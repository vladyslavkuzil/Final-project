"""
Document service layer.

Handles all CRUD operations for project documents.
"""

import uuid
from sqlalchemy.orm import Session
from src.core.storage import StorageBackend
from src.modules.documents.models import Document


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
    db: Session, project_id: str, title: str, file_path: str, user_id: str
) -> Document:
    """Insert a new document row and return it refreshed from the database.

    Args:
        db: Active SQLAlchemy session.
        project_id: Identifier of the project this document belongs to.
        title: Human-readable document title.
        file_path: Storage path or URI of the uploaded file.
        user_id: Identifier of the user performing the upload.

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
    )
    try:
        db.add(doc)
        db.commit()
    except Exception:
        db.rollback()
        raise
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
    # project_id scope prevents cross-project deletions.
    doc = get_document(db, document_id, project_id)
    if not doc:
        return False
    storage.delete(doc.file_path)
    try:
        db.delete(doc)
        db.commit()
    except Exception:
        db.rollback()
        raise
    return True
