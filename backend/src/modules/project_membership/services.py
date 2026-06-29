from sqlalchemy.orm import Session
from src.modules.project_membership.models import ProjectMembership


def get_user_role(project_id: str, user_id: str, db: Session):
    membership = db.query(ProjectMembership).filter(
        ProjectMembership.project_id == project_id,
        ProjectMembership.user_id == user_id
    ).one_or_none()
    return membership.role if membership else None
