from pydantic import BaseModel, EmailStr


class UserCreate(BaseModel):
    email: EmailStr
    password: str


class PublicUser(BaseModel):
    """Minimal public projection of a user (no status/credential fields).

    Used by the invite lookup so an authenticated caller can resolve an email
    to an id without leaking account state such as ``is_active``.
    """

    id: str
    email: EmailStr

    class Config:
        from_attributes = True


class UserResponse(PublicUser):
    is_active: bool


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str


class RefreshRequest(BaseModel):
    refresh_token: str
