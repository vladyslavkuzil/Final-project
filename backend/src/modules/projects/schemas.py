from datetime import datetime
from pydantic import BaseModel, Field, EmailStr
from src.modules.project_membership.models import MembershipRole

class ProjectCreate(BaseModel):
    name: str = Field(max_length=255)
    description: str | None = None


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=255)
    description: str | None = None
    is_finished: bool | None = None


class UserResponse(BaseModel):
    id: str
    email: EmailStr
    is_active: bool
    model_config = {"from_attributes": True}


class ProjectResponse(BaseModel):
    id: str
    name: str
    description: str | None
    documents_count: int
    total_size_bytes: int
    created_at: datetime
    updated_at: datetime
    is_finished: bool
    admin: UserResponse
    users: list[UserResponse]
    current_user_role:MembershipRole
    model_config = {"from_attributes": True}
