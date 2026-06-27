from fastapi import Depends, FastAPI, HTTPException, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from src.core.database import get_db
from src.modules.documents.models import Document  # noqa: F401 — registers tables
from src.modules.documents.router import router as documents_router
from src.modules.auth.router import router as auth_router
from src.modules.projects.router import router as projects_router

app = FastAPI(title="Project Dashboard API")
app.include_router(documents_router)
app.include_router(auth_router)
app.include_router(projects_router)


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
