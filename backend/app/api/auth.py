from typing import Optional
from fastapi import APIRouter, Depends, Header, HTTPException, status

from app.schemas.auth import (
    AuthResponse,
    MessageResponse,
    UserLoginRequest,
    UserRegisterRequest,
    UserResponse,
)
from app.services.auth_service import (
    get_user_from_token,
    login_user,
    logout_user,
    register_user,
)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


def get_token_from_header(authorization: Optional[str] = Header(default=None)) -> Optional[str]:
    if not authorization:
        return None
    parts = authorization.strip().split()
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1]
    if len(parts) == 1:
        return parts[0]
    return None


def get_current_user_required(token: Optional[str] = Depends(get_token_from_header)) -> dict:
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token is missing.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user = get_user_from_token(token)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired or token invalid. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


@router.post("/register", response_model=AuthResponse)
def register(payload: UserRegisterRequest):
    try:
        user, token = register_user(
            email=payload.email,
            full_name=payload.full_name,
            password=payload.password,
        )
        return {
            "token": token,
            "user": user,
            "message": "Account created successfully. Welcome to JourneySynth AI!",
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/login", response_model=AuthResponse)
def login(payload: UserLoginRequest):
    try:
        user, token = login_user(
            email=payload.email,
            password=payload.password,
        )
        return {
            "token": token,
            "user": user,
            "message": "Signed in successfully.",
        }
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc


@router.post("/demo-login", response_model=AuthResponse)
def demo_login():
    try:
        user, token = login_user(
            email="demo@journeysynth.ai",
            password="demo123",
        )
        return {
            "token": token,
            "user": user,
            "message": "Signed in as Alex Vance (Demo Account).",
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Demo account initialization error.") from exc


@router.get("/me", response_model=UserResponse)
def me(user: dict = Depends(get_current_user_required)):
    return user


@router.post("/logout", response_model=MessageResponse)
def logout(token: Optional[str] = Depends(get_token_from_header)):
    if token:
        logout_user(token)
    return {"message": "Logged out successfully.", "status": "ok"}
