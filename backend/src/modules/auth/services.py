from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from .models import User
from .schemas import UserCreate
from .security import get_password_hash, verify_password


def register_user(db: Session, user: UserCreate):
    if db.query(User).filter(User.email == user.email).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered"
        )

    hashed_pwd = get_password_hash(user.password)
    db_user = User(email=user.email, hashed_password=hashed_pwd)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


def authenticate_user(db: Session, email: str, password: str):
    user = db.query(User).filter(User.email == email).first()
    if (
        not user
        or not user.is_active
        or not verify_password(password, user.hashed_password)
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    return user
