from pydantic import AwareDatetime, BaseModel, EmailStr


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


class MemberOut(BaseModel):
    id: str
    email: EmailStr
    is_active: bool
    role: str
    model_config = {"from_attributes": True}


class UsersListResponse(BaseModel):
    users: list[MemberOut]
