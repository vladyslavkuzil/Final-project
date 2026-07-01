from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from src.core.config import CORS_ORIGINS
from src.core.database import get_db
from src.modules.project_membership.models import ProjectMembership  # noqa: F401 — registers tables
from src.modules.documents.models import Document  # noqa: F401 — registers tables
from src.modules.documents.router import router as documents_router
from src.modules.auth.router import router as auth_router, users_router
from src.modules.projects.router import router as projects_router
from src.modules.project_membership.router import router as project_membership_router
from src.modules.chat.router import router as chat_router
from src.modules.chat.ws import router as ws_router


app = FastAPI(title="Project Dashboard API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)
app.include_router(documents_router, prefix="/project/{project_id}/documents")
app.include_router(auth_router)
app.include_router(users_router)
app.include_router(projects_router)
app.include_router(project_membership_router)
app.include_router(chat_router)
app.include_router(ws_router)


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/db-health")
def db_check(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {"status": "connected"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"status": "error", "message": str(e)},
        )
