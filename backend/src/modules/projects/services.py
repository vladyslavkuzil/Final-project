"""
Projects service layer.

Handles all CRUD operations for projects.
"""

import json
from pydantic import TypeAdapter
from sqlalchemy.orm import Session
from src.modules.auth.models import User
from src.core.config import CACHE_TTL
from src.core.cache import redis_client
from src.modules.projects.schemas import ProjectResponse
from src.core.enums import MembershipRole
from src.modules.project_membership.models import ProjectMembership
from src.modules.projects.models import Project

from .exceptions import (
    AccessDeniedError,
    ProjectNotFoundError,
    ProjectAlreadyExistsError,
    UserNotFoundError,
    OwnerCannotLeaveError,
)


def get_project_by_id(db: Session, project_id: str) -> Project | None:
    """Return a single Project object by its primary key(uuid)."""
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


def get_project_by_name_for_member(
    db: Session, name: str, user_id: str
) -> tuple[Project, MembershipRole]:
    """Return a project and membership role for a user that belongs to it."""
    project = get_project_by_name(db, name)
    if project is None:
        raise ProjectNotFoundError(name)

    membership = (
        db.query(ProjectMembership)
        .filter(
            ProjectMembership.project_id == project.id,
            ProjectMembership.user_id == user_id,
        )
        .one_or_none()
    )
    if membership is None:
        raise AccessDeniedError(name)

    return project, membership.role


def _create_project(
    db: Session, name: str, description: str | None = None, admin_id: str = ""
) -> Project:
    """Create a new project and return it refreshed from the database.

    Args:
        db: Active SQLAlchemy session,
        name: Unique project name,
        description: Project description (null/empty allowed)
        admin_id: ID of the user creating the project (kept for backward compat)

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
        description=description,
        admin_id=admin_id,
    )
    db.add(project)
    db.flush()
    return project


def create_project(
    db: Session, name: str, user_id: str, description: str | None = None
) -> Project:
    """Create a new project, assign the creator as OWNER, and return it.

    Args:
        db: Active SQLAlchemy session.
        name: Unique project name.
        user_id: ID of the authenticated user creating the project.
        description: Optional project description.

    Returns:
        The newly created Project with ``user_role`` set to
        ``MembershipRole.OWNER``.

    Raises:
        ProjectAlreadyExistsError: If a project with that name already exists.
        UserNotFoundError: If the creator user is not found in the database.
    """
    try:
        project = _create_project(db, name, description, admin_id=user_id)
        project_membership = ProjectMembership(
            project_id=project.id, user_id=user_id, role=MembershipRole.OWNER
        )

        db.add(project_membership)
        db.commit()
    except Exception:
        db.rollback()
        raise

    db.refresh(project)
    redis_client.delete(f"user:{user_id}:projects")

    project.user_role = project_membership.role

    return project


def get_all_projects(db: Session, user_id: str):

    cache_key = f"user:{user_id}:projects"

    cached = redis_client.get(cache_key)
    if cached:
        return json.loads(cached)

    projects = (
        db.query(Project)
        .join(ProjectMembership, ProjectMembership.project_id == Project.id)
        .filter(ProjectMembership.user_id == user_id)
        .distinct()
        .all()
    )

    adapter = TypeAdapter(list[ProjectResponse])

    serialized_projects = adapter.validate_python(projects)
    serialized_projects = adapter.dump_python(serialized_projects, mode="json")

    redis_client.setex(
        cache_key,
        CACHE_TTL,
        json.dumps(serialized_projects),
    )

    return serialized_projects


def update_project(
    db: Session,
    project_id: str,
    name: str | None = None,
    description: str | None = None,
    is_finished: bool | None = None,
) -> Project:
    """Update mutable Project object fields.

    Args:
        db: Active SQLAlchemy session.
        project_id: Unique project UUID string.
        user_id: ID of the user performing the update (must be owner).
        name: New unique project name.
        description: New project description.
        is_finished: Mark project as done.

    Returns:
        The updated and refreshed Project from the database.

    Raises:
        ProjectNotFoundError: If the project is not found or user is not the owner.
        ProjectAlreadyExistsError: If the new name is already in use.
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
    memberships = (
        db.query(ProjectMembership)
        .filter(ProjectMembership.project_id == project_id)
        .all()
    )
    if not isinstance(memberships, list):
        memberships = [memberships]
    for membership in memberships:
        if membership is not None:
            redis_client.delete(f"user:{membership.user_id}:projects")
    redis_client.delete(f"project:{project_id}")

    return project


def delete_project(db: Session, project_id: str) -> dict:
    """Remove a project from the database.

    Args:
        db: Active SQLAlchemy session.
        project_id: Unique project UUID string.
        user_id: ID of the user performing the deletion (must be owner).

    Returns:
        A dict with a confirmation message.

    Raises:
        ProjectNotFoundError: If the project is not found or user is not the owner.
    """
    project = get_project_by_id(db, project_id)
    if project is None:
        raise ProjectNotFoundError(project_id)

    memberships = (
        db.query(ProjectMembership)
        .filter(ProjectMembership.project_id == project_id)
        .all()
    )
    if not isinstance(memberships, list):
        memberships = [memberships]
    user_ids = [
        membership.user_id for membership in memberships if membership is not None
    ]

    try:
        db.delete(project)
        db.commit()
    except Exception:
        db.rollback()
        raise

    for uid in user_ids:
        redis_client.delete(f"user:{uid}:projects")
    redis_client.delete(f"project:{project_id}")

    return {"message": "Project deleted successfully"}


def add_user_to_project(
    db: Session, user_id: str, project_id: str, admin_id: str | None = None
):
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
    project = get_project_by_id(db, project_id)
    if project is None:
        raise ProjectNotFoundError(project_id)

    user = db.query(User).filter(User.id == user_id).one_or_none()
    if user is None:
        raise UserNotFoundError(user_id)

    existing_membership = (
        db.query(ProjectMembership)
        .filter(
            ProjectMembership.project_id == project_id,
            ProjectMembership.user_id == user_id,
        )
        .one_or_none()
    )
    if existing_membership is None:
        db.add(
            ProjectMembership(
                project_id=project_id,
                user_id=user_id,
                role=MembershipRole.PARTICIPANT,
            )
        )

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise

    db.refresh(project)
    memberships = (
        db.query(ProjectMembership)
        .filter(ProjectMembership.project_id == project_id)
        .all()
    )
    if not isinstance(memberships, list):
        memberships = [memberships]
    for membership in memberships:
        redis_client.delete(f"user:{membership.user_id}:projects")
    redis_client.delete(f"project:{project_id}")
    return project


def leave_project(db: Session, project_id: str, user_id: str) -> None:
    """Remove the current user's own access to a project.

    Args:
        db: Active SQLAlchemy session.
        project_id: Unique project UUID string.
        user_id: ID of the user leaving the project.

    Raises:
        ProjectNotFoundError: If the project does not exist.
        OwnerCannotLeaveError: If the user owns the project (they must delete
            it instead of leaving).
    """
    project = db.query(Project).filter(Project.id == project_id).one_or_none()
    if project is None:
        raise ProjectNotFoundError(project_id)
    if project.admin_id == user_id:
        raise OwnerCannotLeaveError(project_id)

    membership = (
        db.query(ProjectMembership)
        .filter(
            ProjectMembership.project_id == project_id,
            ProjectMembership.user_id == user_id,
        )
        .one_or_none()
    )
    user = db.query(User).filter(User.id == user_id).one_or_none()

    # Capture the affected members before mutating so every member's cached
    # project list is invalidated, not just the leaver's.
    affected_user_ids = {u.id for u in project.users} | {user_id}

    try:
        if user is not None and user in project.users:
            project.users.remove(user)
        if membership is not None:
            db.delete(membership)
        db.commit()
    except Exception:
        db.rollback()
        raise

    for uid in affected_user_ids:
        redis_client.delete(f"user:{uid}:projects")
    redis_client.delete(f"user:{user_id}:project:{project_id}")
