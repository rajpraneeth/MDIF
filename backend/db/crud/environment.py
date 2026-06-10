"""Environment CRUD (PROJECT_SPEC §5 Environments)."""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.crud.base import CRUDBase
from db.models.environment import Environment


class CRUDEnvironment(CRUDBase[Environment]):
    async def get_by_name(
        self, db: AsyncSession, name: str
    ) -> Environment | None:
        stmt = select(Environment).where(Environment.name == name)
        return (await db.execute(stmt)).scalar_one_or_none()


crud_environment = CRUDEnvironment(Environment)
