import uuid
from datetime import datetime
from sqlalchemy import DateTime, func, String, Text, Integer, BigInteger, Boolean, ForeignKey, Table, Column
from sqlalchemy.orm import Mapped, mapped_column, relationship
from src.core.base import Base

project_users = Table(
    "project_users",
    Base.metadata,
    Column("project_id", ForeignKey("projects.id")),
    Column("user_id", ForeignKey("users.id")),
)

class Project(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(
        String, 
        primary_key=True, 
        default=lambda: str(uuid.uuid4()),
        unique=True
    )
    name: Mapped[str] = mapped_column(
        String(255), 
        nullable=False, 
        unique=True
    )
    description: Mapped[str | None] = mapped_column(
        Text, 
        nullable=True
    )
    documents_count: Mapped[int] = mapped_column(
        Integer, 
        default=0
    )
    total_size_bytes: Mapped[int] = mapped_column(
        BigInteger, 
        default=0
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        server_default=func.now()
    )
    is_finished: Mapped[bool] = mapped_column(
        Boolean, 
        default=False
    )
    admin_id: Mapped[str]= mapped_column(
        ForeignKey("users.id"), 
        nullable=False
    )
    admin: Mapped["User"] = relationship(
        foreign_keys=[admin_id]
    )
    users: Mapped[list["User"]] = relationship(
        secondary=project_users,
        foreign_keys=[
            project_users.c.project_id,
            project_users.c.user_id,
        ]
    )

class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(
        String,
        primary_key=True,
    )

