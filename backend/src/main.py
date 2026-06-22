import os
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from src.core.base import Base
from src.core.database import engine, get_db
from src.modules.documents.models import Document  # noqa: F401 — registers tables
from src.modules.documents.router import router as documents_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    if os.getenv("APP_ENV", "local") in {"local", "dev"}:
        Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="Project Dashboard API", lifespan=lifespan)
app.include_router(documents_router)


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
