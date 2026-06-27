from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from src.core.database import get_db
from src.core.dependencies import get_project_or_404
from src.core.security import get_current_user
from src.modules.documents import services
from src.modules.documents.schemas import (
    DocumentCreate,
    DocumentUpdate,
    DocumentResponse,
)

router = APIRouter()


def _safe_filename(file_path: str) -> str:
    """Return just the basename with header-breaking characters removed."""
    return Path(file_path).name.replace('"', "").replace("\r", "").replace("\n", "")


@router.get("/project/{project_id}/documents", response_model=list[DocumentResponse])
def list_documents(
    _: str = Depends(get_current_user),
    db: Session = Depends(get_db),
    project_id: str = Depends(get_project_or_404),
):
    return services.get_documents_by_project(db, project_id)


@router.post(
    "/project/{project_id}/documents",
    response_model=DocumentResponse,
    status_code=status.HTTP_201_CREATED,
)
def upload_document(
    payload: DocumentCreate,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
    project_id: str = Depends(get_project_or_404),
):
    return services.create_document(
        db, project_id, payload.title, payload.file_path, user_id
    )


@router.get("/document/{document_id}")
def download_document(
    document_id: str,
    db: Session = Depends(get_db),
    _: str = Depends(get_current_user),
):
    doc = services.get_document(db, document_id)
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Document not found"
        )

    def _stream():
        yield f"[MOCK FILE CONTENT for: {doc.title}]".encode()

    return StreamingResponse(
        _stream(),
        media_type="application/octet-stream",
        headers={
            "Content-Disposition": f'attachment; filename="{_safe_filename(doc.file_path)}"'
        },
    )


@router.put("/document/{document_id}", response_model=DocumentResponse)
def update_document(
    document_id: str,
    payload: DocumentUpdate,
    db: Session = Depends(get_db),
    _: str = Depends(get_current_user),
):
    doc = services.update_document(db, document_id, payload.title, payload.file_path)
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Document not found"
        )
    return doc


@router.delete("/document/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    document_id: str,
    db: Session = Depends(get_db),
    _: str = Depends(get_current_user),
):
    if not services.delete_document(db, document_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Document not found"
        )
