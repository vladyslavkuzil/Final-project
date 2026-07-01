from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from src.core.database import get_db
from src.core.security import get_current_user
from src.core.dependencies import AccessContext, require_role
from src.core.enums import MembershipRole
from src.modules.projects import services, schemas
from src.modules.projects.exceptions import (
    AccessDeniedError,
    ProjectAlreadyExistsError,
    ProjectNotFoundError,
    UserNotFoundError,
    OwnerCannotLeaveError,
)

router = APIRouter()


@router.post(
    "/projects",
    response_model=schemas.ProjectResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_project(
    payload: schemas.ProjectCreate,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    try:
        return services.create_project(
            db=db,
            name=payload.name,
            description=payload.description,
            user_id=current_user,
        )
    except ProjectAlreadyExistsError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )
    except UserNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )


@router.get(
    "/projects",
    response_model=list[schemas.ProjectResponse],
)
def list_projects(
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    return services.get_all_projects(db, current_user)


@router.get(
    "/project/by-id/{project_id}/info",
    response_model=schemas.ProjectResponse,
)
def retrieve_project_id(
    project_id: str,
    db: Session = Depends(get_db),
    access: AccessContext = Depends(require_role()),
):
    project = services.get_project_by_id(db, project_id)

    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Project not found."
        )
    project["user_role"] = access.role

    return project


@router.get(
    "/project/by-name/{project_name}/info",
    response_model=schemas.ProjectResponse,
)
def retrieve_project_name(
    project_name: str,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    try:
        project, _ = services.get_project_by_name_for_member(
            db, project_name, current_user
        )
    except ProjectNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc
    except AccessDeniedError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)
        ) from exc

    return project


@router.put(
    "/project/{project_id}/info",
    response_model=schemas.ProjectResponse,
)
def update_project(
    project_id: str,
    payload: schemas.ProjectUpdate,
    db: Session = Depends(get_db),
    _: object = Depends(require_role(MembershipRole.OWNER)),
):
    try:
        return services.update_project(
            db=db,
            project_id=project_id,
            name=payload.name,
            description=payload.description,
            is_finished=payload.is_finished,
        )
    except ProjectNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )
    except ProjectAlreadyExistsError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )


@router.delete("/project/{project_id}")
def delete_project(
    project_id: str,
    db: Session = Depends(get_db),
    _: object = Depends(require_role(MembershipRole.OWNER)),
):
    try:
        return services.delete_project(
            db=db,
            project_id=project_id,
        )
    except ProjectNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )


@router.post(
    "/project/{project_id}/leave",
    status_code=status.HTTP_204_NO_CONTENT,
)
def leave_project(
    project_id: str,
    db: Session = Depends(get_db),
    access: AccessContext = Depends(require_role()),
):
    try:
        services.leave_project(db, project_id, access.user_id)
    except ProjectNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )
    except OwnerCannotLeaveError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Project owner cannot leave their own project",
        )


@router.post(
    "/project/{project_id}/invite/{user_id}",
    response_model=schemas.ProjectResponse,
)
def invite_user(
    project_id: str,
    user_id: str,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
    _: MembershipRole = Depends(require_role(MembershipRole.OWNER)),
):
    try:
        return services.add_user_to_project(db, user_id, project_id, current_user)
    except ProjectNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )
    except UserNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )
