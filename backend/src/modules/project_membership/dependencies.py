from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session
from src.core.database import get_db
from src.core.security import get_current_user
from src.modules.project_membership.models import MembershipRole
from src.modules.project_membership.services import get_user_role

_ROLE_RANK = {MembershipRole.PARTICIPANT: 1, MembershipRole.OWNER: 2}


def require_role(required_role: MembershipRole | None = None):
    def _check_access(
            project_id: str,
            db: Session = Depends(get_db),
            user_id: str = Depends(get_current_user),
    ) -> MembershipRole:
        user_role = get_user_role(project_id, user_id, db)
        if user_role is None:
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Access denied")

        if required_role and _ROLE_RANK[user_role] < _ROLE_RANK[required_role]:
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Access denied")
        return user_role

    return _check_access
