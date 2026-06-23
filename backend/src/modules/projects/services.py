"""
Projects service layer.

Handles all CRUD operations for projects.
"""

import uuid
from fastapi import HTTPException
from sqlalchemy.orm import Session
from src.modules.projects.models import Project


def project_name_exists(db: Session, name: str) -> bool:
    """
    Function allows to show HTTP Error code - "name" is set up as unique at model layer. 
    """
    return db.query(Project).filter(Project.name == name).first() is not None


def create_project(db: Session, name: str, description: str) -> Project:
    """Create a new project and return it refreshed from the database.

    Args:
        db: Active SQLAlchemy session,
        name: Unique project name,
        description: Project description (null/empty allowed)
    
    Returns:
        The newly created Project, refreshed from the database.
    """
    if project_name_exists(db, name):
        raise HTTPException(
            status_code=409,
            detail=f"The name: {name} is already assigned."
        )
    
    project = Project(
        name=name,
        description = description,
    )

    try:
        db.add(project)
        db.commit()
    except Exception:
        db.rollback()
        raise

    db.refresh(project)
    return project


def get_project(db: Session, project_id: str) -> Project | None:
    """Return a single Project object by its primary key(uuid), None if no project is found.

    Args:
        db: Active SQLAlchemy session,
        project_id: Unique project UUID string.

    Returns:
        The matching Project object, or None if no row is found.
    """
    return db.query(Project).filter(Project.id == project_id).one_or_none()


def update_project(
        db: Session, 
        project_id: str, 
        name: str | None = None, 
        description: str | None = None, 
        is_finished: bool | None = None,
) -> Project:
    """Update mutable Project object fields.

    Args:
        db: Active SQLAlchemy session,
        name: New unique project name,
        description: New project description,
        is_finished: Mark project as done.
    
    Returns:
        The updated and refreshed Project from the database, or None if the document does not exist.
    """
    project = get_project(db, project_id)
    if project is None:
        raise HTTPException(
            status_code=404,
            detail=f"The project_id: {project_id} not found."
        )
    
    if project_name_exists(db, name):
        raise HTTPException(
            status_code=409,
            detail=f"The name: {name} is already assigned."
        )
    
    if name is not None:
        project.name = name
    if description is not None:
        project.description = description
    if is_finished is not None:
        project.is_finished = is_finished
    
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise

    db.refresh(project)
    return project


