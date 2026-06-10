"""Shared FastAPI dependencies: current-user resolution and role guards.

(PROJECT_SPEC §10 Security, §3 RBAC; PRD decision 1.)

``get_current_user`` validates the Bearer **access** token (refresh tokens are
cookie-only and are not accepted here). ``require_role`` builds a dependency that
enforces one of the allowed roles on an endpoint.
"""
from __future__ import annotations

import uuid

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from core.security import decode_token
from db.base import get_db
from db.crud.user import crud_user
from db.enums import UserRole
from db.models.user import User

# auto_error=False so we can raise a consistent 401 envelope ourselves.
_bearer = HTTPBearer(auto_error=False)

_CREDENTIALS_EXC = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Could not validate credentials",
    headers={"WWW-Authenticate": "Bearer"},
)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: AsyncSession = Depends(get_db),
) -> User:
    if credentials is None:
        raise _CREDENTIALS_EXC
    payload = decode_token(credentials.credentials)
    if payload is None or payload.get("type") != "access":
        raise _CREDENTIALS_EXC
    sub = payload.get("sub")
    if not sub:
        raise _CREDENTIALS_EXC
    try:
        user_id = uuid.UUID(str(sub))
    except ValueError:
        raise _CREDENTIALS_EXC
    user = await crud_user.get(db, user_id)
    if user is None or not user.is_active:
        raise _CREDENTIALS_EXC
    return user


def require_role(*roles: UserRole):
    """Dependency factory enforcing that the caller holds one of ``roles``."""

    allowed = set(roles)

    async def _guard(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return current_user

    return _guard
