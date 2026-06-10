"""Pipeline-run CRUD with filtered listing (PROJECT_SPEC §5 Runs)."""
from __future__ import annotations

import uuid
from collections.abc import Sequence

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.crud.base import CRUDBase
from db.enums import RunStatus
from db.models.pipeline_run import PipelineRun


class CRUDPipelineRun(CRUDBase[PipelineRun]):
    async def list_filtered(
        self,
        db: AsyncSession,
        *,
        page: int,
        page_size: int,
        pipeline_id: uuid.UUID | None = None,
        status: RunStatus | None = None,
    ) -> tuple[Sequence[PipelineRun], int]:
        page = max(page, 1)
        page_size = max(min(page_size, 200), 1)

        stmt = select(PipelineRun)
        if pipeline_id is not None:
            stmt = stmt.where(PipelineRun.pipeline_id == pipeline_id)
        if status is not None:
            stmt = stmt.where(PipelineRun.status == status)

        total = (
            await db.execute(select(func.count()).select_from(stmt.subquery()))
        ).scalar_one()
        stmt = (
            stmt.order_by(PipelineRun.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        items = (await db.execute(stmt)).scalars().all()
        return items, total

    async def latest_for_pipeline(
        self, db: AsyncSession, pipeline_id: uuid.UUID
    ) -> PipelineRun | None:
        stmt = (
            select(PipelineRun)
            .where(PipelineRun.pipeline_id == pipeline_id)
            .order_by(PipelineRun.created_at.desc())
            .limit(1)
        )
        return (await db.execute(stmt)).scalar_one_or_none()


crud_pipeline_run = CRUDPipelineRun(PipelineRun)
