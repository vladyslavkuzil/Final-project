from dataclasses import dataclass

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from src.core.database import get_db
from src.core.enums import MembershipRole
from src.core.security import get_current_user
from src.modules.project_membership.models import ProjectMembership
from src.modules.projects.models import Project

_ROLE_RANK = {MembershipRole.PARTICIPANT: 1, MembershipRole.OWNER: 2}


@dataclass
class AccessContext:
    role: MembershipRole
    user_id: str


def require_role(required_role: MembershipRole | None = None):
    def _check_access(
        project_id: str,
        db: Session = Depends(get_db),
        user_id: str = Depends(get_current_user),
    ) -> AccessContext:
        exists = db.query(Project.id).filter(Project.id == project_id).first()
        if not exists:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Project not found"
            )
        membership = (
            db.query(ProjectMembership)
            .filter(
                ProjectMembership.project_id == project_id,
                ProjectMembership.user_id == user_id,
            )
            .one_or_none()
        )
        if membership is None:
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Access denied")
        if (
            required_role
            and _ROLE_RANK.get(membership.role, 0) < _ROLE_RANK[required_role]
        ):
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Access denied")
        return AccessContext(role=membership.role, user_id=user_id)

    return _check_access
