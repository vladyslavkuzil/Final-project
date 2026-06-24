from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from src.core.database import get_db
from src.core.security import get_current_user

from src.modules.projects import services, schemas

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
    return services.create_project(
        db=db, 
        name=payload.name, 
        description=payload.description,
        admin_id=current_user,
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
    "/project/{project_id}/info",
    response_model=schemas.ProjectResponse,
)
def retreive_project(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    project = services.get_project_by_id(db, project_id, current_user)

    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Project not found."
        )
    
    return project


@router.get(
    "/project/{project_name}/info",
    response_model=schemas.ProjectResponse,
)
def retreive_project(
    project_name: str,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    project = services.get_project_by_name(db, project_name, current_user)

    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Project not found."
        )
    
    return project


@router.put(
    "/project/{project_id}/info",
    response_model=schemas.ProjectUpdate,
)
def update_project(
    project_id: str,
    payload: schemas.ProjectUpdate,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    return services.update_project(
        db=db,
        project_id=project_id,
        user_id=current_user,
        name=payload.name,
        description=payload.description,
        is_finished=payload.is_finished
    )


@router.delete("/project/{project_id}")
def delete_project(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    return services.delete_project(
        db=db,
        project_id=project_id,
        user_id=current_user,
    )


@router.post(
    "/project/{project_id}/invite",
    response_model=schemas.ProjectResponse,
)
def invite_user(
    project_id: str,
    user_id: str,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    return services.add_user_to_project(db, user_id, project_id,  current_user)
