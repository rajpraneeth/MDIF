"""Connection CRUD — env-scoped, soft-delete aware (PROJECT_SPEC §5)."""
from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.crud.base import CRUDBase
from db.models.connection import Connection


class CRUDConnection(CRUDBase[Connection]):
    async def get_by_name_env(
        self, db: AsyncSession, name: str, env_id: uuid.UUID
    ) -> Connection | None:
        """Live connection matching the (name, env_id) idempotency key."""
        stmt = (
            select(Connection)
            .where(Connection.name == name)
            .where(Connection.env_id == env_id)
            .where(Connection.deleted_at.is_(None))
        )
        return (await db.execute(stmt)).scalar_one_or_none()


crud_connection = CRUDConnection(Connection)
