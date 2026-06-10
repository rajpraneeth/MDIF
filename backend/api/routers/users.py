"""Users routes (PROJECT_SPEC §5 Users).

Reads are available to any authenticated user; writes (create / update / delete)
are admin-only per the ticket spec ("Users CRUD, admin write").
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.dependencies import get_current_user, require_role
from core.security import hash_password
from db.base import get_db
from db.crud.user import crud_user
from db.enums import UserRole
from db.models.user import User
from schemas.common import Envelope, Page
from schemas.user import UserCreate, UserRead, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])

_admin_only = require_role(UserRole.admin)


@router.get("", response_model=Envelope[Page[UserRead]])
async def list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> Envelope[Page[UserRead]]:
    items, total = await crud_user.get_multi(db, page=page, page_size=page_size)
    return Envelope(
        data=Page(
            items=[UserRead.model_validate(u) for u in items],
            total=total,
            page=page,
            page_size=page_size,
        ),
        message="",
    )


@router.post("", response_model=Envelope[UserRead], status_code=status.HTTP_201_CREATED)
async def create_user(
    body: UserCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_admin_only),
) -> Envelope[UserRead]:
    if await crud_user.get_by_email(db, body.email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email already exists",
        )
    data = body.model_dump(exclude={"password"})
    data["hashed_password"] = hash_password(body.password)
    user = await crud_user.create(db, data)
    await db.commit()
    return Envelope(data=UserRead.model_validate(user), message="User created")


@router.get("/{user_id}", response_model=Envelope[UserRead])
async def get_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> Envelope[UserRead]:
    user = await crud_user.get(db, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return Envelope(data=UserRead.model_validate(user), message="")


@router.patch("/{user_id}", response_model=Envelope[UserRead])
async def update_user(
    user_id: uuid.UUID,
    body: UserUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_admin_only),
) -> Envelope[UserRead]:
    user = await crud_user.get(db, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    changes = body.model_dump(exclude_unset=True)
    if "password" in changes:
        changes["hashed_password"] = hash_password(changes.pop("password"))
    user = await crud_user.update(db, user, changes)
    await db.commit()
    return Envelope(data=UserRead.model_validate(user), message="User updated")


@router.delete("/{user_id}", response_model=Envelope[None])
async def delete_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_admin_only),
) -> Envelope[None]:
    user = await crud_user.get(db, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    await crud_user.soft_delete(db, user)
    await db.commit()
    return Envelope(data=None, message="User deleted")
