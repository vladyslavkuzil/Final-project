"""
API:

***
POST /projects - Create project from details (name, description). <-DONE

Automatically gives access to created project to user, making him the owner (admin of the project). <-Not done, I need user module first

***

GET /projects - Get all projects, <- done
accessible for a user. <- user module not finished
Returns list of projects full info(details + documents). <-documents details included, all documents (as files) shouldnt rather be returned with one command

***

GET /project/<project_id>/info - Return project’s details, <- done
if user has access <- user module not finished - if user is saved in object: users (model)

***

PUT /project/<project_id>/info - Update projects details - name, description. Returns the updated project’s info <- done

***

DELETE /project/<project_id>- Delete project, can only be performed by the projects’ owner. Deletes the corresponding documents


POST /project/<project_id>/invite?user=<login> - Grant access to the project for a specific user. If the request is not coming from the owner of the project, results in error. Granting access gives participant permissions to receiving user

OPTIONAL:
GET /project/<project_id>/share?with=<email> - send a GET /join link with correct hashed token for the requested project to specified email, that can be opened by a different user in a browser



TEGO NIE - TO JEST W DOCUMENTS:
GET /project/<project_id>/documents- Return all of the project's documents

POST /project/<project_id>/documents - Upload document/documents for a specific project
"""

from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from src.core.database import get_db
from src.core.security import get_current_user

from src.modules.projects import services, schemas
# from src.modules.projects.schemas import ProjectCreate, ProjectUpdate, ProjectResponse

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
):
    return services.get_all_projects(db=db)


@router.get(
    "/project/{project_id}/info",
    response_model=schemas.ProjectResponse,
)
def retreive_project(
    project_id: str,
    db: Session = Depends(get_db),
):
    project = services.get_project_by_id(db, project_id)

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
):
    project = services.get_project_by_name(db, project_name)

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
):
    return services.update_project(
        db=db,
        project_id=project_id,
        name=payload.name,
        description=payload.description,
        is_finished=payload.is_finished
    )

# API:

# DELETE /project/<project_id>- Delete project, can only be performed by the projects’ owner. Deletes the corresponding documents

# GET /project/<project_id>/documents- Return all of the project's documents

# POST /project/<project_id>/documents - Upload document/documents for a specific project

# POST /project/<project_id>/invite?user=<login> - Grant access to the project for a specific user. If the request is not coming from the owner of the project, results in error. Granting access gives participant permissions to receiving user

# OPTIONAL:
# GET /project/<project_id>/share?with=<email> - send a GET /join link with correct hashed token for the requested project to specified email, that can be opened by a different user in a browser