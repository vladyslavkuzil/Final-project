from datetime import datetime, timezone

import secrets
from psycopg2.errors import UniqueViolation
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from src.core.cache import redis_client
from src.core.enums import MembershipRole
from src.modules.auth.models import User
from src.modules.project_membership.exceptions import (
    InvalidJoinCodeError,
    AlreadyMemberError,
    UserNotFoundError,
    MemberNotFoundError,
    SelfRemovalError,
)
from src.modules.project_membership.models import ProjectMembership, JoinCode

# Exclude visually ambiguous chars: 0/O, 1/I
INVITE_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def _generate_invite_code(length: int = 8) -> str:
    """Generate a random invite code of the given length.

    Characters are drawn from INVITE_CODE_ALPHABET, which excludes visually
    ambiguous characters (0/O, 1/I/L) to reduce transcription errors.
    """
    return "".join(secrets.choice(INVITE_CODE_ALPHABET) for _ in range(length))


def _delete_existing_code(db: Session, project_id: str):
    """Mark the existing join code for a project for deletion, if one exists.

    Does not commit — the caller is responsible for committing the transaction.
    """
    existing_code = (
        db.query(JoinCode).filter(JoinCode.project_id == project_id).one_or_none()
    )
    if existing_code is not None:
        db.delete(existing_code)


def _add_user(db: Session, project_id: str, user_id: str):
    """Add a user to a project as a PARTICIPANT.

    Raises AlreadyMemberError if the user is already a member of the project.
    Does not commit — the caller is responsible for committing the transaction.
    """
    existing_membership = (
        db.query(ProjectMembership)
        .filter(
            ProjectMembership.project_id == project_id,
            ProjectMembership.user_id == user_id,
        )
        .one_or_none()
    )

    if existing_membership:
        raise AlreadyMemberError

    db.add(
        ProjectMembership(
            project_id=project_id,
            user_id=user_id,
            role=MembershipRole.PARTICIPANT,
        )
    )


def _get_user_or_raise(
    db: Session, email: str | None = None, user_id: str | None = None
):
    """Fetch a user by email or user_id and return them.

    Raises UserNotFoundError if no matching user is found.
    At least one of email or user_id must be provided; if both are None the
    function will always raise UserNotFoundError.
    """
    user = None
    if email is not None:
        user = db.query(User).filter(User.email == email).one_or_none()

    elif user_id is not None:
        user = db.query(User).filter(User.id == user_id).one_or_none()

    if user is None:
        raise UserNotFoundError
    return user


def get_user_role(db: Session, project_id: str, user_id: str):
    """Return the role of a user in a project, or None if they are not a member."""
    membership = (
        db.query(ProjectMembership)
        .filter(
            ProjectMembership.project_id == project_id,
            ProjectMembership.user_id == user_id,
        )
        .one_or_none()
    )
    return membership.role if membership else None


def create_join_code(
    db: Session, project_id: str, created_by: str, expires_at: datetime | None = None
):
    """Create a new join code for a project, replacing any previously existing one.

    Only one join code can exist per project at a time. The old code is deleted
    and the new one is inserted in a single transaction, so the project is never
    left without a code if the operation fails.

    Returns the newly created JoinCode instance.
    """
    _delete_existing_code(db, project_id)

    join_code = JoinCode(
        code=_generate_invite_code(),
        project_id=project_id,
        created_by=created_by,
        expires_at=expires_at,
    )
    db.add(join_code)
    db.commit()
    db.refresh(join_code)

    return join_code


def join_project(db: Session, code: str, user_id: str):
    """Add the current user to the project associated with the given join code.

    Raises InvalidJoinCodeError if the code does not exist or has expired.
    Raises AlreadyMemberError if the user is already a member of the project.
    Invalidates the user's project list cache on success.
    Returns a dict with the joined project_id on success.
    """
    join_code = db.query(JoinCode).filter(JoinCode.code == code).one_or_none()

    if join_code is None:
        raise InvalidJoinCodeError

    project_id = join_code.project_id

    if join_code.expires_at is not None and join_code.expires_at <= datetime.now(
        timezone.utc
    ):
        raise InvalidJoinCodeError

    try:
        _add_user(db=db, project_id=project_id, user_id=user_id)
        db.commit()
    except IntegrityError as e:
        db.rollback()
        if isinstance(e.orig, UniqueViolation):
            raise AlreadyMemberError
        raise
    except Exception:
        db.rollback()
        raise

    redis_client.delete(f"user:{user_id}:projects")
    redis_client.delete(f"project:{project_id}")
    return {"project_id": project_id}


def invite_user_by_email(db: Session, project_id: str, email: str):
    """Add a user to a project by their email address.

    Raises UserNotFoundError if no account with the given email exists.
    Raises AlreadyMemberError if the user is already a member of the project.
    Invalidates the invited user's project list cache on success.
    Returns a confirmation dict on success.
    """
    user = _get_user_or_raise(db=db, email=email)
    try:
        _add_user(db=db, project_id=project_id, user_id=user.id)
        db.commit()
    except IntegrityError as e:
        db.rollback()
        if isinstance(e.orig, UniqueViolation):
            raise AlreadyMemberError
        raise
    except Exception:
        db.rollback()
        raise

    redis_client.delete(f"user:{user.id}:projects")
    redis_client.delete(f"project:{project_id}")
    return {"message": "User invited successfully"}


def get_users(db: Session, project_id: str):
    """Return all members of a project.

    Returns a dict with a 'users' key containing a list of User ORM instances.
    """
    users = (
        db.query(User)
        .join(ProjectMembership, ProjectMembership.user_id == User.id)
        .filter(ProjectMembership.project_id == project_id)
        .all()
    )
    return {"users": users}


def remove_user(db: Session, project_id: str, user_id: str, caller_id: str):
    """Remove a user from a project.

    Raises SelfRemovalError if the caller attempts to remove themselves.
    Raises UserNotFoundError if no account with the given user_id exists.
    Raises MemberNotFoundError if the user is not a member of the project.
    Returns a confirmation dict on success.
    """
    if caller_id == user_id:
        raise SelfRemovalError

    _get_user_or_raise(db=db, user_id=user_id)
    user_membership = (
        db.query(ProjectMembership)
        .filter(
            ProjectMembership.project_id == project_id,
            ProjectMembership.user_id == user_id,
        )
        .one_or_none()
    )
    if user_membership is None:
        raise MemberNotFoundError

    try:
        db.delete(user_membership)
        db.commit()
    except Exception:
        db.rollback()
        raise

    redis_client.delete(f"user:{user_id}:projects")
    redis_client.delete(f"project:{project_id}")
    return {"message": "User removed from project"}
