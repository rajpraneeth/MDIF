"""Pipeline CRUD — env-scoped, soft-delete aware (PROJECT_SPEC §5)."""
from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.crud.base import CRUDBase
from db.models.pipeline import Pipeline


class CRUDPipeline(CRUDBase[Pipeline]):
    async def get_by_name_env(
        self, db: AsyncSession, name: str, env_id: uuid.UUID
    ) -> Pipeline | None:
        stmt = (
            select(Pipeline)
            .where(Pipeline.name == name)
            .where(Pipeline.env_id == env_id)
            .where(Pipeline.deleted_at.is_(None))
        )
        return (await db.execute(stmt)).scalar_one_or_none()


crud_pipeline = CRUDPipeline(Pipeline)
