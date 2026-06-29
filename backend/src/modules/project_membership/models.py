import uuid
from datetime import datetime

from sqlalchemy import String, Enum, DateTime, func, UniqueConstraint, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from src.core.base import Base
from src.core.enums import MembershipRole


class ProjectMembership(Base):
    __table_args__ = (UniqueConstraint("project_id", "user_id"),)
    __tablename__ = "project_membership"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    project_id: Mapped[str] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )

    role: Mapped[MembershipRole] = mapped_column(Enum(MembershipRole), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
