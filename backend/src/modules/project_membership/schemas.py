from pydantic import AwareDatetime, BaseModel, EmailStr
from src.modules.auth.schemas import UserResponse


class JoinCodeCreateRequest(BaseModel):
    expires_at: AwareDatetime | None = None


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
