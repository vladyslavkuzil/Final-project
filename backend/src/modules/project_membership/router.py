from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from src.core.database import get_db
from src.core.dependencies import AccessContext, require_role
from src.core.enums import MembershipRole
from src.core.security import get_current_user
from src.modules.project_membership import services, schemas
from src.modules.project_membership.exceptions import (
    InvalidJoinCodeError,
    AlreadyMemberError,
    MemberNotFoundError,
    UserNotFoundError,
    SelfRemovalError,
)


router = APIRouter()


@router.post(
    "/project/{project_id}/join-code",
    status_code=status.HTTP_201_CREATED,
    response_model=schemas.JoinCodeResponse,
)
async def create_join_code(
    project_id: str,
    payload: schemas.JoinCodeCreateRequest,
    db: Session = Depends(get_db),
    access: AccessContext = Depends(require_role(MembershipRole.OWNER)),
):
    if payload.expires_at is not None and payload.expires_at <= datetime.now(
        timezone.utc
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="expires_at must be a future datetime",
        )
    return services.create_join_code(
        db=db,
        project_id=project_id,
        created_by=access.user_id,
        expires_at=payload.expires_at,
    )


@router.post(
    "/join/{code}",
    status_code=status.HTTP_201_CREATED,
    response_model=schemas.ProjectIdResponse,
)
async def join_project(
    code: str, db: Session = Depends(get_db), user_id: str = Depends(get_current_user)
):
    try:
        return services.join_project(db=db, code=code, user_id=user_id)
    except InvalidJoinCodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid join code",
        )
    except AlreadyMemberError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Already a member of this project",
        )


@router.post(
    "/project/{project_id}/invite",
    status_code=status.HTTP_201_CREATED,
    response_model=schemas.MemberInviteResponse,
)
async def invite_user(
    project_id: str,
    payload: schemas.InviteUserRequest,
    db: Session = Depends(get_db),
    _: AccessContext = Depends(require_role(MembershipRole.OWNER)),
):
    try:
        return services.invite_user_by_email(
            db=db, project_id=project_id, email=payload.email
        )
    except UserNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No account found for the given email address",
        )
    except AlreadyMemberError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Already a member of this project",
        )


@router.get(
    "/project/{project_id}/members",
    status_code=status.HTTP_200_OK,
    response_model=schemas.UsersListResponse,
)
async def get_project_members(
    project_id: str,
    db: Session = Depends(get_db),
    _: AccessContext = Depends(require_role()),
):
    return services.get_users(db=db, project_id=project_id)


@router.delete(
    "/project/{project_id}/members/{user_id}",
    status_code=status.HTTP_200_OK,
    response_model=schemas.MemberRemoveResponse,
)
async def remove_user(
    project_id: str,
    user_id: str,
    db: Session = Depends(get_db),
    access: AccessContext = Depends(require_role(MembershipRole.OWNER)),
):
    try:
        return services.remove_user(
            db=db, project_id=project_id, user_id=user_id, caller_id=access.user_id
        )
    except SelfRemovalError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot remove yourself from the project",
        )
    except UserNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No account found for the given user ID",
        )
    except MemberNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User is not a member of this project",
        )
