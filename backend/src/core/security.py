from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from src.modules.projects.models import Project
from src.core.config import SECRET_KEY, ALGORITHM
from src.modules.project_membership.models import ProjectMembership
import jwt

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_user_id_from_token(token: str) -> str:
    """
    Decode JWT token and return user_id.
    Works for both HTTP and WebSocket.
    """

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

        if payload.get("type") != "access":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type",
            )

        user_id = payload.get("sub")

        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload",
            )

        return user_id

    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired",
        )

    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )


def get_current_user(token: str = Depends(oauth2_scheme)) -> str:
    """Return the authenticated user's ID."""
    return get_user_id_from_token(token)


def verify_project_access(project_id: str, user_id: str, db: Session) -> bool:
    """
    Verify if a user has access to a specific project.

    Args:
        project_id (str): The ID of the project.
        user_id (str): The ID of the user.
        db (Session): The database session.

    Returns:
        bool: True if the user has access to the project, False otherwise.
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if project is None:
        return False

    if project.admin_id == user_id:
        return True

    membership = (
        db.query(ProjectMembership)
        .filter(
            ProjectMembership.project_id == project_id,
            ProjectMembership.user_id == user_id,
        )
        .first()
    )
    return membership is not None
