from pydantic import BaseModel
from typing import Literal, Optional


class WSMessageIn(BaseModel):
    type: Literal["message"] = "message"
    content: str
    message_id: Optional[str] = None


class WSMessageOut(BaseModel):
    type: Literal["message", "edit", "delete"]
    id: str
    project_id: str
    sender_id: str
    sender_email: str
    content: str
    created_at: str
