from datetime import datetime

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload
from src.modules.chat.models import Message


def get_messages(project_id: str, offset: int, limit: int, db: Session):
    """
    Retrieve all messages for a specific project.

    Args:
        project_id (str): The ID of the project.
        offset (int): The number of messages to skip.
        limit (int): The maximum number of messages to retrieve.
        db (Session): The database session.

    Returns:
        List[dict]: A list of messages with sender email for the project.
    """
    limit = min(limit, 100)
    messages = (
        db.query(Message)
        .options(joinedload(Message.sender))
        .filter(Message.project_id == project_id)
        .filter(Message.deleted_at.is_(None))
        .order_by(Message.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return [
        {
            "id": m.id,
            "project_id": m.project_id,
            "sender_id": m.sender_id,
            "sender_email": m.sender.email,
            "content": m.content,
            "created_at": str(m.created_at),
        }
        for m in messages
    ]


def create_message(project_id: str, user_id: str, content: str, db: Session):
    """
    Create a new message in a project.

    Args:
        project_id (str): The ID of the project.
        user_id (str): ID of the sender.
        content (str): Message text.
        db (Session): Database session.

    Returns:
        Message: The created message.
    """

    message = Message(project_id=project_id, sender_id=user_id, content=content)

    db.add(message)
    db.commit()
    db.refresh(message)

    return message


def update_message(message_id: str, user_id: str, content: str, db: Session):
    message = db.query(Message).filter(Message.id == message_id).first()

    if not message:
        return None

    if message.sender_id != user_id:
        raise PermissionError("Not allowed to edit this message")

    message.content = content
    message.updated_at = func.now()

    db.commit()
    db.refresh(message)

    return message


def delete_message(message_id: str, user_id: str, db: Session):
    message = db.query(Message).filter(Message.id == message_id).first()

    if not message:
        return None

    if message.sender_id != user_id:
        raise PermissionError("Not allowed to delete this message")

    message.deleted_at = datetime.utcnow()

    db.commit()
    db.refresh(message)

    return message
