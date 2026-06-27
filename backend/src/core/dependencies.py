from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from src.core.database import get_db
from src.core.security import get_current_user
from src.modules.projects.models import Project


def get_project_or_404(
    project_id: str,
    db: Session = Depends(get_db),
    _: str = Depends(get_current_user),
) -> str:
    exists = db.query(Project.id).filter(Project.id == project_id).first()
    if not exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Project not found"
        )
    return project_id
