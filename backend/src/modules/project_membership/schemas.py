from datetime import datetime
from pydantic import BaseModel, EmailStr
from src.modules.auth.schemas import UserResponse


class JoinCodeCreateRequest(BaseModel):
    expires_at: datetime | None = None


class JoinCodeResponse(BaseModel):
    code: str
    model_config = {"from_attributes": True}


class ProjectIdResponse(BaseModel):
    project_id: str
    model_config = {"from_attributes": True}


class InviteUserRequest(BaseModel):
    email: EmailStr


class MemberInviteResponse(BaseModel):
    message: str


class MemberRemoveResponse(BaseModel):
    message: str


class UsersListResponse(BaseModel):
    users: list[UserResponse]
