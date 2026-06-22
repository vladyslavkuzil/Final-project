from datetime import datetime
from pathlib import Path
from pydantic import BaseModel, field_validator

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".xlsx", ".txt"}


def _validate_file_path(value: str) -> str:
    ext = Path(value).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        allowed = ", ".join(sorted(ALLOWED_EXTENSIONS))
        raise ValueError(f"File extension '{ext}' is not allowed. Accepted: {allowed}")
    return value


class DocumentCreate(BaseModel):
    title: str
    file_path: str

    @field_validator("file_path")
    @classmethod
    def validate_extension(cls, v: str) -> str:
        return _validate_file_path(v)


class DocumentUpdate(BaseModel):
    title: str | None = None
    file_path: str | None = None

    @field_validator("file_path")
    @classmethod
    def validate_extension(cls, v: str | None) -> str | None:
        if v is not None:
            return _validate_file_path(v)
        return v


class DocumentResponse(BaseModel):
    id: str
    title: str
    file_path: str
    project_id: str
    uploaded_by: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
