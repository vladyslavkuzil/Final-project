from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from src.core.database import get_db
from src.core.security import get_current_user, verify_project_access
from src.modules.chat.models import Message
from src.modules.chat.services import (
    create_message,
    delete_message,
    get_messages,
    update_message,
)

router = APIRouter(prefix="/chat", tags=["Chat"])


@router.get("/{project_id}/messages")
def get_project_messages(
    project_id: str,
    offset: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    if not verify_project_access(project_id, user_id, db):
        raise HTTPException(status_code=403, detail="Access denied to this project.")

    return get_messages(
        project_id=project_id,
        offset=offset,
        limit=limit,
        db=db,
    )


@router.post("/{project_id}/messages")
def create_project_message(
    project_id: str,
    content: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    if not verify_project_access(project_id, user_id, db):
        raise HTTPException(status_code=403, detail="Access denied to this project.")

    return create_message(
        project_id=project_id,
        user_id=user_id,
        content=content,
        db=db,
    )


@router.put("/messages/{message_id}")
def update_project_message(
    message_id: str,
    content: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    message = db.query(Message).filter(Message.id == message_id).first()

    if not message:
        raise HTTPException(status_code=404, detail="Message not found")

    if not verify_project_access(message.project_id, user_id, db):
        raise HTTPException(status_code=403, detail="Access denied to this project.")

    return update_message(
        message_id=message_id,
        user_id=user_id,
        content=content,
        db=db,
    )


@router.delete("/messages/{message_id}")
def delete_project_message(
    message_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    message = db.query(Message).filter(Message.id == message_id).first()

    if not message:
        raise HTTPException(status_code=404, detail="Message not found")

    if not verify_project_access(message.project_id, user_id, db):
        raise HTTPException(status_code=403, detail="Access denied to this project.")

    delete_message(
        message_id=message_id,
        user_id=user_id,
        db=db,
    )

    return {"detail": "Message deleted"}
