import re
from typing import Optional
from pydantic import BaseModel, Field, field_validator


class UserRegisterRequest(BaseModel):
    email: str = Field(..., description="User email address")
    full_name: str = Field(..., min_length=2, max_length=100, description="User full name")
    password: str = Field(..., min_length=6, max_length=128, description="User password")

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        v = v.strip().lower()
        if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", v):
            raise ValueError("Invalid email address format.")
        return v

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2:
            raise ValueError("Full name must be at least 2 characters.")
        return v


class UserLoginRequest(BaseModel):
    email: str = Field(..., description="User email address")
    password: str = Field(..., min_length=1, description="User password")

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        return v.strip().lower()


class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    created_at: str
    last_login: Optional[str] = None


class AuthResponse(BaseModel):
    token: str
    user: UserResponse
    message: str = "Authentication successful"


class MessageResponse(BaseModel):
    message: str
    status: str = "ok"
