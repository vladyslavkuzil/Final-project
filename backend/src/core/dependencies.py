from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from src.core.database import get_db
from src.modules.projects.models import Project


def get_project_or_404(project_id: str, db: Session = Depends(get_db)) -> str:
    if not db.query(Project).filter(Project.id == project_id).first():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Project not found"
        )
    return project_id
