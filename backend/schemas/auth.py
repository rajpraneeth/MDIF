"""Auth schemas (PROJECT_SPEC §5 Auth, PRD decision 1).

Login/refresh return the access token + user in the body; the refresh token is
delivered only as an httpOnly cookie and never appears in any response body.
"""
from __future__ import annotations

from pydantic import BaseModel, EmailStr

from schemas.user import UserRead


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenData(BaseModel):
    """Body payload for login & refresh (PRD decision 1: no refresh token here)."""

    access_token: str
    token_type: str = "bearer"
    user: UserRead
