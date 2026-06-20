from sqlalchemy import text
from fastapi import FastAPI, Depends, HTTPException, status
from .core.database import get_db
from sqlalchemy.orm import Session

app = FastAPI(title="Project Dashboard API")


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
