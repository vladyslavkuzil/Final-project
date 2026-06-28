"""
Projects service layer.

Handles all CRUD operations for projects.
"""

from sqlalchemy.orm import Session
from src.modules.projects.models import Project
from src.modules.auth.models import User
from src.modules.project_membership.models import ProjectMembership,MembershipRole


from .exceptions import (
    ProjectNotFoundError,
    ProjectAlreadyExistsError,
    UserNotFoundError,
)


def get_project_by_id(db: Session, project_id: str, user_id: str) -> Project | None:
    """Return a single Project object by its primary key(uuid) available for user_id, None if no project is found.

    Args:
        db: Active SQLAlchemy session,
        project_id: Unique project UUID string.

    Returns:
        The matching Project object, or None if no row is found.
    """
    project_membership=db.query(ProjectMembership).filter(
            ProjectMembership.project_id == project_id,
            ProjectMembership.user_id == user_id
        ).one_or_none()
    
    if project_membership is None:
        return None
    
    project=db.query(Project).filter(Project.id==project_id).one_or_none()
    project.current_user_role=project_membership.role

    return project


def get_project_by_id_admin(
    db: Session, project_id: str, user_id: str
) -> Project | None:
    """Return a single Project object by its primary key(uuid) available as admin, None if no project is found.

    Args:
        db: Active SQLAlchemy session,
        project_id: Unique project UUID string.

    Returns:
        The matching Project object, or None if no row is found.
    """
    return (
        db.query(Project)
        .filter(
            Project.id == project_id,
            Project.admin_id == user_id,
        )
        .one_or_none()
    )


def get_project_by_name(db: Session, name: str) -> Project | None:
    """Return a single Project object by its name, None if no project is found.

    Args:
        db: Active SQLAlchemy session,
        name: Unique project name string.

    Returns:
        The matching Project object, or None if no row is found.
    """
    return db.query(Project).filter(Project.name == name).one_or_none()


def get_project_by_name_admin(db: Session, name: str, user_id: str) -> Project | None:
    """Return a single Project object by its name available as admin, None if no project is found.

    Args:
        db: Active SQLAlchemy session,
        name: Unique project name string.

    Returns:
        The matching Project object, or None if no row is found.
    """
    return (
        db.query(Project)
        .filter(
            Project.name == name,
            Project.admin_id == user_id,
        )
        .one_or_none()
    )


def _create_project(
    db: Session, name: str, admin_id: str, description: str | None = None
) -> Project:
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

    admin = db.query(User).filter(User.id == admin_id).one_or_none()
    if admin is None:
        raise UserNotFoundError(admin_id)

    project = Project(
        name=name,
        description=description,
        admin_id=admin.id,
    )
    project.users.append(admin)

    try:
        db.add(project)
        db.flush()
    except Exception:
        db.rollback()
        raise

    return project

def create_project(db: Session, name: str, admin_id: str, description: str | None = None
):
    try:
        project = _create_project(db, name, admin_id, description)
        project_membership = ProjectMembership(project_id=project.id, user_id=admin_id, role=MembershipRole.OWNER)

        db.add(project_membership)
        db.commit()
    except Exception:
        db.rollback()
        raise

    db.refresh(project)

    project.current_user_role=project_membership.role

    return project


def get_all_projects(db: Session, user_id: str) -> list[Project]:
    """Return a list of all Projects available for user.

    Args:
        db: Active SQLAlchemy session,
        user_id: Current logged user.

    Returns:
        Full list of all Projects objects.
    """
    return db.query(Project).filter(Project.users.any(User.id == user_id)).all()


def update_project(
    db: Session,
    project_id: str,
    user_id: str,
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
    project = get_project_by_id_admin(db, project_id, user_id)
    if project is None:
        raise ProjectNotFoundError(project_id)

    if name is not None and name != project.name:
        existing_project = get_project_by_name_admin(db, name, user_id)
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


def delete_project(db: Session, project_id: str, user_id: str) -> dict:
    """Removes project from a database.

    Args:
        db: Active SQLAlchemy session,
        project_id: Unique project UUID string.

    Returns:
        True if project is deleted.

    Raises:
        ProjectNotFoundError - if project is not found.
    """
    project = get_project_by_id_admin(db, project_id, user_id)
    if project is None:
        raise ProjectNotFoundError(project_id)

    try:
        db.delete(project)
        db.commit()
    except Exception:
        db.rollback()
        raise

    return {"message": "Project deleted successfully"}


def add_user_to_project(db: Session, user_id: str, project_id: str, admin_id: str):
    """Grant access to the project for a specific user.

    Args:
        db: Active SQLAlchemy session,
        user_id: User id to be added to Project,
        project_id: Unique project UUID string,
        admin_id: Current logged user.

    Returns:
        Updated Project.

    Raises:
        ProjectNotFoundError - if project is not found,
    """
    project = get_project_by_id_admin(db, project_id, admin_id)
    if project is None:
        raise ProjectNotFoundError(project_id)

    # user = get_or_create_user(db, user_id)
    user = db.query(User).filter(User.id == user_id).one_or_none()
    if user is None:
        raise UserNotFoundError(user_id)

    if user not in project.users:
        project.users.append(user)

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise

    db.refresh(project)
    return project
