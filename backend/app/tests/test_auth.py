import uuid
import pytest
from app.database import init_db
from app.services.auth_service import (
    ensure_demo_user,
    get_user_from_token,
    hash_password,
    login_user,
    logout_user,
    register_user,
    verify_password,
)


def test_password_hashing():
    pwd = "MySecretPassword123!"
    h1, salt1 = hash_password(pwd)
    assert h1 and salt1
    assert verify_password(pwd, salt1, h1) is True
    assert verify_password("WrongPassword!", salt1, h1) is False


def test_auth_service_lifecycle():
    init_db()
    ensure_demo_user()

    # 1. Demo login
    demo_user, demo_token = login_user("demo@journeysynth.ai", "demo123")
    assert demo_user["email"] == "demo@journeysynth.ai"
    assert demo_token.startswith("jst_")

    # 2. Register new user
    unique_email = f"user_{uuid.uuid4().hex[:6]}@example.com"
    user, token = register_user(
        email=unique_email,
        full_name="Dr. Taylor Synthetic",
        password="ValidPassword789!",
        role="Data Scientist",
    )
    assert user["email"] == unique_email
    assert user["full_name"] == "Dr. Taylor Synthetic"
    assert token.startswith("jst_")

    # 3. Duplicate registration should raise ValueError
    with pytest.raises(ValueError, match="already exists"):
        register_user(
            email=unique_email,
            full_name="Duplicate User",
            password="ValidPassword789!",
        )

    # 4. Fetch user by session token
    fetched_user = get_user_from_token(token)
    assert fetched_user is not None
    assert fetched_user["email"] == unique_email

    # 5. Login with newly created user
    logged_in_user, new_token = login_user(unique_email, "ValidPassword789!")
    assert logged_in_user["email"] == unique_email
    assert new_token.startswith("jst_")

    # 6. Login with wrong password should raise ValueError
    with pytest.raises(ValueError, match="Invalid email or password"):
        login_user(unique_email, "WrongPassword!")

    # 7. Logout revokes token
    logout_user(new_token)
    assert get_user_from_token(new_token) is None
