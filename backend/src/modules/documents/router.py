from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from src.core.database import get_db
from src.core.security import get_current_user
from src.modules.documents import services
from src.modules.documents.schemas import DocumentCreate, DocumentUpdate, DocumentResponse

router = APIRouter()


@router.get("/project/{project_id}/documents", response_model=list[DocumentResponse])
def list_documents(
    project_id: str,
    db: Session = Depends(get_db),
):
    return services.get_documents_by_project(db, project_id)


@router.post(
    "/project/{project_id}/documents",
    response_model=DocumentResponse,
    status_code=status.HTTP_201_CREATED,
)
def upload_document(
    project_id: str,
    payload: DocumentCreate,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    return services.create_document(db, project_id, payload.title, payload.file_path, user_id)


@router.get("/document/{document_id}")
def download_document(
    document_id: str,
    db: Session = Depends(get_db),
):
    doc = services.get_document(db, document_id)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    def _stream():
        yield f"[MOCK FILE CONTENT for: {doc.title}]".encode()

    return StreamingResponse(
        _stream(),
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{doc.file_path}"'},
    )


@router.put("/document/{document_id}", response_model=DocumentResponse)
def update_document(
    document_id: str,
    payload: DocumentUpdate,
    db: Session = Depends(get_db),
):
    doc = services.update_document(db, document_id, payload.title, payload.file_path)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return doc


@router.delete("/document/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    document_id: str,
    db: Session = Depends(get_db),
):
    if not services.delete_document(db, document_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
