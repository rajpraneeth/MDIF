"""Schema-object detail route (PROJECT_SPEC §5).

Discovery and listing happen under ``/connections/{id}``; this exposes the
single-object detail (full columns JSONB, profiling metadata).
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.dependencies import get_current_user
from db.base import get_db
from db.crud.schema_object import crud_schema_object
from db.models.user import User
from schemas.common import Envelope
from schemas.schema_object import SchemaObjectRead

router = APIRouter(prefix="/schema-objects", tags=["schema-objects"])


@router.get("/{object_id}", response_model=Envelope[SchemaObjectRead])
async def get_schema_object(
    object_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> Envelope[SchemaObjectRead]:
    obj = await crud_schema_object.get(db, object_id)
    if obj is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Schema object not found"
        )
    return Envelope(data=SchemaObjectRead.model_validate(obj), message="")
