from pathlib import Path
from urllib.parse import quote

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


def _resized_key(original_key: str) -> str | None:
    """Map an original S3 key to the image_resize lambda's output key.

    Mirrors the lambda's rules: only original/-prefixed jpg/jpeg/png keys are
    processed, and jpeg output always lands under a .jpg extension. Returns
    None for keys the lambda never touches (including local-storage keys).
    """
    if not original_key.startswith("original/"):
        return None
    ext = Path(original_key).suffix.lower()
    key = original_key.replace("original/", "resized/", 1)
    if ext in (".jpg", ".jpeg"):
        return str(Path(key).with_suffix(".jpg"))
    if ext == ".png":
        return key
    return None


def _content_disposition(filename: str) -> str:
    """Build a Content-Disposition header that survives non-latin-1 filenames.

    HTTP headers must be latin-1, so non-ASCII names go in the RFC 5987
    filename* parameter with a plain-ASCII fallback in filename.
    """
    fallback = filename.encode("ascii", "ignore").decode() or "download"
    return f"attachment; filename=\"{fallback}\"; filename*=UTF-8''{quote(filename)}"


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
    stored_path = await storage.save(file, project_id)
    return services.create_document(
        db, project_id, title, stored_path, access.user_id, file_size=file.size or 0
    )


@router.get("/{document_id}")
def download_document(
    project_id: str,
    document_id: str,
    variant: str = "original",
    db: Session = Depends(get_db),
    _: AccessContext = Depends(require_role()),
    storage: StorageBackend = Depends(get_storage),
):
    doc = services.get_document(db, document_id, project_id)
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Document not found"
        )

    # Prefer the lambda-resized copy when asked for, falling back to the
    # original if it doesn't exist (local storage, unsupported formats, images
    # the lambda skipped, or resize still in flight).
    path = doc.file_path
    if variant == "resized":
        resized = _resized_key(doc.file_path)
        if resized and storage.exists(resized):
            path = resized

    # Resolve the stored file up front: the byte stream is produced lazily, so a
    # missing/invalid key would otherwise raise mid-stream, after the 200 status
    # and headers have already been sent. Check now to return a clean 404.
    if not storage.exists(path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Document file not found"
        )

    return StreamingResponse(
        storage.get(path),
        media_type="application/octet-stream",
        headers={
            "Content-Disposition": _content_disposition(
                _download_filename(doc.title, doc.file_path)
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
