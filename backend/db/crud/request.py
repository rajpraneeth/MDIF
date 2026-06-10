"""Ingestion-request CRUD with role-aware listing (PROJECT_SPEC §5, §8)."""
from __future__ import annotations

import uuid
from collections.abc import Sequence

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.crud.base import CRUDBase
from db.enums import RequestStatus
from db.models.ingestion_request import IngestionRequest


class CRUDRequest(CRUDBase[IngestionRequest]):
    async def list_filtered(
        self,
        db: AsyncSession,
        *,
        page: int,
        page_size: int,
        requested_by: uuid.UUID | None = None,
        status: RequestStatus | None = None,
        env_id: uuid.UUID | None = None,
    ) -> tuple[Sequence[IngestionRequest], int]:
        """List live requests, optionally scoped to one requester (requester role)."""
        page = max(page, 1)
        page_size = max(min(page_size, 200), 1)

        stmt = select(IngestionRequest).where(IngestionRequest.deleted_at.is_(None))
        if requested_by is not None:
            stmt = stmt.where(IngestionRequest.requested_by == requested_by)
        if status is not None:
            stmt = stmt.where(IngestionRequest.status == status)
        if env_id is not None:
            stmt = stmt.where(IngestionRequest.env_id == env_id)

        total = (
            await db.execute(select(func.count()).select_from(stmt.subquery()))
        ).scalar_one()
        stmt = (
            stmt.order_by(IngestionRequest.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        items = (await db.execute(stmt)).scalars().all()
        return items, total


crud_request = CRUDRequest(IngestionRequest)
