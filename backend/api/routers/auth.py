"""Auth routes: login / refresh / logout / me (PROJECT_SPEC §5, PRD decision 1).

Token transport (PRD decision 1): ``login`` and ``refresh`` return
``{ access_token, token_type, user }`` in the body; the refresh token is set only
as an httpOnly cookie and is never present in any response body.
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from core.dependencies import get_current_user
from core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    verify_password,
)
from db.base import get_db
from db.crud.user import crud_user
from db.models.user import User
from schemas.auth import LoginRequest, TokenData
from schemas.common import Envelope
from schemas.user import UserRead

router = APIRouter(prefix="/auth", tags=["auth"])

REFRESH_COOKIE_NAME = "refresh_token"
# Cookie is scoped to the auth endpoints so it is only sent where it is needed.
REFRESH_COOKIE_PATH = "/api/v1/auth"


def _set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=token,
        httponly=True,
        samesite="lax",
        secure=settings.ENVIRONMENT_NAME not in ("dev", "test", "local"),
        path=REFRESH_COOKIE_PATH,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        key=REFRESH_COOKIE_NAME,
        path=REFRESH_COOKIE_PATH,
        httponly=True,
        samesite="lax",
    )


def _issue_tokens(response: Response, user: User) -> TokenData:
    access = create_access_token(user.id)
    refresh = create_refresh_token(user.id)
    _set_refresh_cookie(response, refresh)
    return TokenData(access_token=access, user=UserRead.model_validate(user))


@router.post("/login", response_model=Envelope[TokenData])
async def login(
    body: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> Envelope[TokenData]:
    user = await crud_user.get_by_email(db, body.email)
    if user is None or not verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="User is inactive"
        )
    return Envelope(data=_issue_tokens(response, user), message="Logged in")


@router.post("/refresh", response_model=Envelope[TokenData])
async def refresh(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> Envelope[TokenData]:
    token = request.cookies.get(REFRESH_COOKIE_NAME)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing refresh token",
        )
    payload = decode_token(token)
    if payload is None or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )
    sub = payload.get("sub")
    try:
        user_id = uuid.UUID(str(sub)) if sub else None
    except ValueError:
        user_id = None
    user = await crud_user.get(db, user_id) if user_id else None
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )
    # Rotate the refresh token on every use.
    return Envelope(data=_issue_tokens(response, user), message="Token refreshed")


@router.post("/logout", response_model=Envelope[None])
async def logout(response: Response) -> Envelope[None]:
    _clear_refresh_cookie(response)
    return Envelope(data=None, message="Logged out")


@router.get("/me", response_model=Envelope[UserRead])
async def me(current_user: User = Depends(get_current_user)) -> Envelope[UserRead]:
    return Envelope(data=UserRead.model_validate(current_user), message="")
