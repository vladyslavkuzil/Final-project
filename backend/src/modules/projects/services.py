"""
Projects service layer.

Handles all CRUD operations for projects.
"""

from sqlalchemy.orm import Session
from src.modules.projects.models import Project
from .exceptions import ProjectNotFoundError, ProjectAlreadyExistsError


def get_project_by_id(db: Session, project_id: str) -> Project | None:
    """Return a single Project object by its primary key(uuid), None if no project is found.

    Args:
        db: Active SQLAlchemy session,
        project_id: Unique project UUID string.

    Returns:
        The matching Project object, or None if no row is found.
    """
    return db.query(Project).filter(Project.id == project_id).one_or_none()


def get_project_by_name(db: Session, name: str) -> Project | None:
    """Return a single Project object by its name, None if no project is found.

    Args:
        db: Active SQLAlchemy session,
        name: Unique project name string.

    Returns:
        The matching Project object, or None if no row is found.
    """
    return db.query(Project).filter(Project.name == name).one_or_none()


def create_project(db: Session, name: str, description: str | None = None) -> Project:
    """Create a new project and return it refreshed from the database.

    Args:
        db: Active SQLAlchemy session,
        name: Unique project name,
        description: Project description (null/empty allowed)
    
    Returns:
        The newly created Project object
    
    Raises:
        ProjectAlreadyExistsError - if project name already in use.
    """
    existing_project = get_project_by_name(db, name)
    if existing_project:
        raise ProjectAlreadyExistsError(existing_project.name)
    
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


def get_all_projects(db: Session) -> list[Project]:
    """Return a list of all Projects.

    Args:
        db: Active SQLAlchemy session,

    Returns:
        Full list of all Projects objects.
    """
    return db.query(Project).all()


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
        The updated and refreshed Project from the database,
    
    Raises:
        ProjectNotFoundError - if project is not found.
        ProjectAlreadyExistsError - if project name already in use.
    """
    project = get_project_by_id(db, project_id)
    if project is None:
        raise ProjectNotFoundError(project_id)
    
    if name is not None and name != project.name:
        existing_project = get_project_by_name(db, name)
        if existing_project:
            raise ProjectAlreadyExistsError(existing_project.name)
    
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


def delete_project(db: Session, project_id: str) -> bool:
    """Removes project from a database.
    
    Args:
        db: Active SQLAlchemy session,
        project_id: Unique project UUID string.
    
    Returns:
        True if project is deleted, Exception if project is not found.

    Raises:
        ProjectNotFoundError - if project is not found.
    """
    project = get_project_by_id(db, project_id)
    if project is None:
        raise ProjectNotFoundError(project_id)
    
    try:
        db.delete(project)
        db.commit()
    except Exception:
        db.rollback()
        raise

    return True