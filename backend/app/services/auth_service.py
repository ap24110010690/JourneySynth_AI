from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import secrets
from typing import Any, Dict, Optional, Tuple
import uuid

from app.database import (
    create_auth_token,
    create_user,
    delete_auth_token,
    delete_expired_tokens,
    get_user_by_email,
    get_user_by_id,
    get_user_by_token,
    update_user_last_login,
    utc_now_iso,
)

PBKDF2_ITERATIONS = 100_000
TOKEN_VALIDITY_DAYS = 30


def hash_password(password: str, salt: Optional[str] = None) -> Tuple[str, str]:
    if not salt:
        salt = secrets.token_hex(16)
    salt_bytes = bytes.fromhex(salt)
    key = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt_bytes,
        PBKDF2_ITERATIONS,
    )
    return key.hex(), salt


def verify_password(password: str, salt: str, expected_hash: str) -> bool:
    try:
        calculated_hash, _ = hash_password(password, salt)
        return hmac.compare_digest(calculated_hash, expected_hash)
    except Exception:
        return False


def generate_session_token(user_id: str) -> str:
    # Generate a cryptographically secure random token
    raw_token = secrets.token_urlsafe(32)
    token = f"jst_{raw_token}"
    expires_at = (datetime.now(timezone.utc) + timedelta(days=TOKEN_VALIDITY_DAYS)).isoformat()
    create_auth_token(token=token, user_id=user_id, expires_at=expires_at)
    return token


def register_user(
    email: str,
    full_name: str,
    password: str,
    role: str = "Analyst",
) -> Tuple[Dict[str, Any], str]:
    clean_email = email.strip().lower()
    existing = get_user_by_email(clean_email)
    if existing:
        raise ValueError("An account with this email address already exists.")

    user_id = f"usr-{uuid.uuid4().hex[:8]}"
    pwd_hash, salt = hash_password(password)
    user_record = create_user(
        user_id=user_id,
        email=clean_email,
        full_name=full_name.strip(),
        password_hash=pwd_hash,
        salt=salt,
        role=role,
    )
    token = generate_session_token(user_id)
    return user_record, token


def login_user(email: str, password: str) -> Tuple[Dict[str, Any], str]:
    clean_email = email.strip().lower()
    user = get_user_by_email(clean_email)
    if not user:
        raise ValueError("Invalid email or password.")

    if not verify_password(password, user["salt"], user["password_hash"]):
        raise ValueError("Invalid email or password.")

    now_iso = utc_now_iso()
    update_user_last_login(user["id"], now_iso)
    user["last_login"] = now_iso

    token = generate_session_token(user["id"])
    return {
        "id": user["id"],
        "email": user["email"],
        "full_name": user["full_name"],
        "role": user["role"],
        "created_at": user["created_at"],
        "last_login": user["last_login"],
    }, token


def get_user_from_token(token: str) -> Optional[Dict[str, Any]]:
    if not token or not token.startswith("jst_"):
        return None
    delete_expired_tokens()
    return get_user_by_token(token)


def logout_user(token: str) -> None:
    if token:
        delete_auth_token(token)


def ensure_demo_user() -> None:
    """Ensure a default demo user exists for quick evaluation."""
    demo_email = "demo@journeysynth.ai"
    if not get_user_by_email(demo_email):
        pwd_hash, salt = hash_password("demo123")
        create_user(
            user_id="usr-demo-001",
            email=demo_email,
            full_name="Alex Vance (Demo)",
            password_hash=pwd_hash,
            salt=salt,
            role="Data Scientist",
        )
