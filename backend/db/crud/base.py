"""Generic async CRUD base (PROJECT_SPEC §11 Prompt 1).

Provides ``get``, ``get_multi`` (paginated), ``create``, ``update`` and
``soft_delete``. Soft-delete-aware: models carrying a ``deleted_at`` column are
filtered to live rows by default and ``soft_delete`` stamps the column rather than
issuing a hard DELETE (§10: soft deletes only). Models without ``deleted_at`` are
hard-deleted.

Pagination returns ``(items, total)``; service layers wrap that in the
``{items, total, page, page_size}`` envelope (PRD decision 4).
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Generic, Sequence, TypeVar

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.base import Base

ModelType = TypeVar("ModelType", bound=Base)


class CRUDBase(Generic[ModelType]):
    def __init__(self, model: type[ModelType]) -> None:
        self.model = model

    @property
    def _soft_deletable(self) -> bool:
        return hasattr(self.model, "deleted_at")

    def _live_only(self, stmt):
        if self._soft_deletable:
            return stmt.where(self.model.deleted_at.is_(None))
        return stmt

    async def get(
        self, db: AsyncSession, id: Any, *, include_deleted: bool = False
    ) -> ModelType | None:
        stmt = select(self.model).where(self.model.id == id)
        if not include_deleted:
            stmt = self._live_only(stmt)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_multi(
        self,
        db: AsyncSession,
        *,
        page: int = 1,
        page_size: int = 20,
        filters: dict[str, Any] | None = None,
        include_deleted: bool = False,
    ) -> tuple[Sequence[ModelType], int]:
        page = max(page, 1)
        page_size = max(min(page_size, 200), 1)

        stmt = select(self.model)
        if not include_deleted:
            stmt = self._live_only(stmt)
        for field, value in (filters or {}).items():
            column = getattr(self.model, field, None)
            if column is not None and value is not None:
                stmt = stmt.where(column == value)

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await db.execute(count_stmt)).scalar_one()

        stmt = stmt.offset((page - 1) * page_size).limit(page_size)
        if hasattr(self.model, "created_at"):
            stmt = stmt.order_by(self.model.created_at.desc())
        items = (await db.execute(stmt)).scalars().all()
        return items, total

    async def create(self, db: AsyncSession, obj_in: dict[str, Any]) -> ModelType:
        db_obj = self.model(**obj_in)
        db.add(db_obj)
        await db.flush()
        await db.refresh(db_obj)
        return db_obj

    async def update(
        self, db: AsyncSession, db_obj: ModelType, obj_in: dict[str, Any]
    ) -> ModelType:
        for field, value in obj_in.items():
            setattr(db_obj, field, value)
        db.add(db_obj)
        await db.flush()
        await db.refresh(db_obj)
        return db_obj

    async def soft_delete(self, db: AsyncSession, db_obj: ModelType) -> ModelType:
        if self._soft_deletable:
            db_obj.deleted_at = datetime.now(timezone.utc)
            db.add(db_obj)
            await db.flush()
            await db.refresh(db_obj)
            return db_obj
        await db.delete(db_obj)
        await db.flush()
        return db_obj
