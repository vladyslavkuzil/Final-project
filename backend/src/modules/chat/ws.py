# src/modules/chat/ws.py

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import ValidationError
from sqlalchemy.orm import Session

from src.modules.chat.manager import ConnectionManager
from src.modules.chat.schemas import WSMessageIn, WSMessageOut
from src.modules.chat import services as service
from src.core.database import SessionLocal
from src.core.security import get_user_id_from_token, verify_project_access

router = APIRouter(prefix="/ws", tags=["WebSocket"])
manager = ConnectionManager()


@router.websocket("/projects/{project_id}")
async def project_chat_ws(websocket: WebSocket, project_id: str, token: str):
    db: Session = SessionLocal()

    try:
        # 1. AUTH
        user_id = get_user_id_from_token(token)

        # 2. ACCESS CHECK
        if not verify_project_access(project_id, user_id, db):
            await websocket.close(code=1008)
            return

        # 3. CONNECT
        await manager.connect(project_id, websocket)

        # 4. MESSAGE LOOP
        while True:
            raw = await websocket.receive_text()

            try:
                message_in = WSMessageIn.model_validate_json(raw)
            except ValidationError:
                await websocket.send_json(
                    {"type": "error", "detail": "Invalid message payload"}
                )
                continue

            if message_in.type != "message":
                continue

            if not message_in.content:
                continue

            # 5. SAVE TO DB
            message = service.create_message(
                project_id=project_id,
                user_id=user_id,
                content=message_in.content,
                db=db,
            )

            # 6. BUILD RESPONSE
            message_out = WSMessageOut(
                type="message",
                id=message.id,
                project_id=project_id,
                sender_id=user_id,
                content=message.content,
                created_at=str(message.created_at),
            )

            # 7. BROADCAST
            await manager.broadcast(project_id, message_out.model_dump())

    except WebSocketDisconnect:
        manager.disconnect(project_id, websocket)

    finally:
        db.close()
