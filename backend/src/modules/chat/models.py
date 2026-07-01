import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, String, DateTime, func, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.core.base import Base
from src.modules.auth.models import User
from src.modules.projects.models import Project


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(
        String,
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )

    content: Mapped[str] = mapped_column(Text, nullable=False)

    sender_id: Mapped[str] = mapped_column(
        ForeignKey("users.id"),
        index=True,
        nullable=False,
    )

    project_id: Mapped[str] = mapped_column(
        ForeignKey("projects.id"),
        index=True,
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        onupdate=func.now(),
        nullable=True,
    )

    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    project: Mapped["Project"] = relationship()
    sender: Mapped["User"] = relationship()
