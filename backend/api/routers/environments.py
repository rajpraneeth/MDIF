"""Environments routes (PROJECT_SPEC §5 Environments).

Reads are available to any authenticated user; create/update are admin-only
(PRD decision 2: admin manages environments and sees across all of them).
Environments are not soft-deleted, so no delete endpoint is exposed in v1.
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.dependencies import get_current_user, require_role
from db.base import get_db
from db.crud.environment import crud_environment
from db.enums import UserRole
from db.models.user import User
from schemas.common import Envelope, Page
from schemas.environment import EnvironmentCreate, EnvironmentRead, EnvironmentUpdate

router = APIRouter(prefix="/environments", tags=["environments"])

_admin_only = require_role(UserRole.admin)


@router.get("", response_model=Envelope[Page[EnvironmentRead]])
async def list_environments(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> Envelope[Page[EnvironmentRead]]:
    items, total = await crud_environment.get_multi(db, page=page, page_size=page_size)
    return Envelope(
        data=Page(
            items=[EnvironmentRead.model_validate(e) for e in items],
            total=total,
            page=page,
            page_size=page_size,
        ),
        message="",
    )


@router.post(
    "", response_model=Envelope[EnvironmentRead], status_code=status.HTTP_201_CREATED
)
async def create_environment(
    body: EnvironmentCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_admin_only),
) -> Envelope[EnvironmentRead]:
    if await crud_environment.get_by_name(db, body.name):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An environment with this name already exists",
        )
    env = await crud_environment.create(db, body.model_dump())
    await db.commit()
    return Envelope(
        data=EnvironmentRead.model_validate(env), message="Environment created"
    )


@router.get("/{env_id}", response_model=Envelope[EnvironmentRead])
async def get_environment(
    env_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> Envelope[EnvironmentRead]:
    env = await crud_environment.get(db, env_id)
    if env is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Environment not found"
        )
    return Envelope(data=EnvironmentRead.model_validate(env), message="")


@router.patch("/{env_id}", response_model=Envelope[EnvironmentRead])
async def update_environment(
    env_id: uuid.UUID,
    body: EnvironmentUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_admin_only),
) -> Envelope[EnvironmentRead]:
    env = await crud_environment.get(db, env_id)
    if env is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Environment not found"
        )
    env = await crud_environment.update(db, env, body.model_dump(exclude_unset=True))
    await db.commit()
    return Envelope(
        data=EnvironmentRead.model_validate(env), message="Environment updated"
    )
