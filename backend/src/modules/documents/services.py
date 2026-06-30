"""
Document service layer.

Handles all CRUD operations for project documents.
"""

import uuid
from sqlalchemy.orm import Session
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
    """Fetch a single document by its primary key, scoped to a project.

    Filtering by both document_id and project_id ensures a document from
    a different project cannot be accessed via an unrelated project's URL.

    Args:
        db: Active SQLAlchemy session.
        document_id: UUID string of the document to retrieve.
        project_id: UUID string of the project the document must belong to.

    Returns:
        The matching Document, or None if not found within this project.
    """
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
    """Update mutable metadata fields on an existing document.

    Only fields supplied with a non-None value are modified; omitted fields
    retain their current values. project_id is required to scope the lookup
    and prevent cross-project modifications.

    Args:
        db: Active SQLAlchemy session.
        document_id: UUID string of the document to update.
        project_id: UUID string of the project the document must belong to.
        title: New title, or None to leave unchanged.
        file_path: New file path, or None to leave unchanged.

    Returns:
        The updated Document refreshed from the database, or None if the
        document does not exist within this project.

    Raises:
        Exception: Re-raises any database error after rolling back the
            transaction to leave the session in a clean state.
    """
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


def delete_document(db: Session, document_id: str, project_id: str) -> bool:
    """Remove a document row from the database, scoped to a project.

    project_id is required to scope the lookup and prevent cross-project
    deletions.

    Args:
        db: Active SQLAlchemy session.
        document_id: UUID string of the document to delete.
        project_id: UUID string of the project the document must belong to.

    Returns:
        True if the document was found and deleted, False if it did not exist
        within this project.

    Raises:
        Exception: Re-raises any database error after rolling back the
            transaction to leave the session in a clean state.
    """
    doc = get_document(db, document_id, project_id)
    if not doc:
        return False
    try:
        db.delete(doc)
        db.commit()
    except Exception:
        db.rollback()
        raise
    return True
