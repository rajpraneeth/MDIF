"""Pipeline-run routes: history, logs, cancel (PROJECT_SPEC §5 Runs).

DE+ only. ``cancel`` is a stub transition: queued/running → cancelled (anything
already in a terminal state → 409).
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.dependencies import require_role
from db.base import get_db
from db.crud.pipeline_run import crud_pipeline_run
from db.enums import RunStatus, UserRole
from db.models.pipeline_run import PipelineRun
from db.models.user import User
from schemas.common import Envelope, Page
from schemas.run import LogEntrySchema, RunRead

router = APIRouter(prefix="/runs", tags=["runs"])

_de_plus = require_role(
    UserRole.data_engineer, UserRole.architect, UserRole.manager, UserRole.admin
)

# Non-terminal states a run can be cancelled from.
_CANCELLABLE = {RunStatus.queued, RunStatus.running}


async def _get_or_404(db: AsyncSession, run_id: uuid.UUID) -> PipelineRun:
    run = await crud_pipeline_run.get(db, run_id)
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")
    return run


@router.get("", response_model=Envelope[Page[RunRead]])
async def list_runs(
    pipeline_id: uuid.UUID | None = Query(default=None),
    status_filter: RunStatus | None = Query(default=None, alias="status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_de_plus),
) -> Envelope[Page[RunRead]]:
    items, total = await crud_pipeline_run.list_filtered(
        db, page=page, page_size=page_size, pipeline_id=pipeline_id, status=status_filter
    )
    return Envelope(
        data=Page(
            items=[RunRead.model_validate(r) for r in items],
            total=total,
            page=page,
            page_size=page_size,
        ),
        message="",
    )


@router.get("/{run_id}", response_model=Envelope[RunRead])
async def get_run(
    run_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_de_plus),
) -> Envelope[RunRead]:
    run = await _get_or_404(db, run_id)
    return Envelope(data=RunRead.model_validate(run), message="")


@router.get("/{run_id}/logs", response_model=Envelope[list[LogEntrySchema]])
async def get_run_logs(
    run_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_de_plus),
) -> Envelope[list[LogEntrySchema]]:
    run = await _get_or_404(db, run_id)
    return Envelope(
        data=[LogEntrySchema(**entry) for entry in (run.logs or [])],
        message="",
    )


@router.post("/{run_id}/cancel", response_model=Envelope[RunRead])
async def cancel_run(
    run_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_de_plus),
) -> Envelope[RunRead]:
    run = await _get_or_404(db, run_id)
    if run.status not in _CANCELLABLE:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot cancel a run in status '{run.status.value}'",
        )
    run = await crud_pipeline_run.update(
        db,
        run,
        {"status": RunStatus.cancelled, "ended_at": datetime.now(timezone.utc)},
    )
    await db.commit()
    return Envelope(data=RunRead.model_validate(run), message="Run cancelled")
