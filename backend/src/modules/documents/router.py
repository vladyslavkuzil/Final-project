from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from src.core.database import get_db
from src.core.dependencies import AccessContext, require_role
from src.core.enums import MembershipRole
from src.core.storage import StorageBackend, get_storage
from src.modules.documents import services
from src.modules.documents.schemas import (
    DocumentUpdate,
    DocumentResponse,
    validate_file_path,
)

router = APIRouter()


def _safe_filename(file_path: str) -> str:
    """Return just the basename with header-breaking characters removed."""
    return Path(file_path).name.replace('"', "").replace("\r", "").replace("\n", "")


def _download_filename(title: str, stored_path: str) -> str:
    """Build a safe download filename from the title, keeping the stored extension."""
    name = _safe_filename(title)
    if not Path(name).suffix:
        name += Path(stored_path).suffix
    return name


@router.get("", response_model=list[DocumentResponse])
def list_documents(
    project_id: str,
    db: Session = Depends(get_db),
    _: AccessContext = Depends(require_role()),
):
    return services.get_documents_by_project(db, project_id)


@router.post("", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    project_id: str,
    title: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    access: AccessContext = Depends(require_role()),
    storage: StorageBackend = Depends(get_storage),
):
    try:
        validate_file_path(file.filename or "")
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    stored_path = await storage.save(file)
    return services.create_document(db, project_id, title, stored_path, access.user_id)


@router.get("/{document_id}")
def download_document(
    project_id: str,
    document_id: str,
    db: Session = Depends(get_db),
    _: AccessContext = Depends(require_role()),
    storage: StorageBackend = Depends(get_storage),
):
    doc = services.get_document(db, document_id, project_id)
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Document not found"
        )

    # Resolve the stored file up front: the byte stream is produced lazily, so a
    # missing/invalid key would otherwise raise mid-stream, after the 200 status
    # and headers have already been sent. Check now to return a clean 404.
    if not storage.exists(doc.file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Document file not found"
        )

    return StreamingResponse(
        storage.get(doc.file_path),
        media_type="application/octet-stream",
        headers={
            "Content-Disposition": (
                f'attachment; filename="{_download_filename(doc.title, doc.file_path)}"'
            )
        },
    )


@router.put("/{document_id}", response_model=DocumentResponse)
def update_document(
    project_id: str,
    document_id: str,
    payload: DocumentUpdate,
    db: Session = Depends(get_db),
    _: AccessContext = Depends(require_role()),
):
    doc = services.update_document(
        db, document_id, project_id, payload.title, payload.file_path
    )
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Document not found"
        )
    return doc


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    project_id: str,
    document_id: str,
    db: Session = Depends(get_db),
    _: AccessContext = Depends(require_role(MembershipRole.OWNER)),
    storage: StorageBackend = Depends(get_storage),
):
    if not services.delete_document(db, storage, document_id, project_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Document not found"
        )
