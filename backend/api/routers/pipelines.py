"""Pipeline routes + run/pause/resume lifecycle (PROJECT_SPEC §5 Pipelines, §6).

All pipeline endpoints are DE+ (data_engineer / architect / manager / admin) —
requesters have no pipeline access (§7 RBAC). Triggering a run drives the engine
adapter stub, which completes immediately as ``succeeded`` with mock metrics
(PRD decision 3); the ``PipelineRun`` row is persisted and queryable.
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.dependencies import require_role
from db.base import get_db
from db.crud.pipeline import crud_pipeline
from db.crud.pipeline_run import crud_pipeline_run
from db.crud.request import crud_request
from db.enums import PipelineStatus, RequestStatus, RunStatus, UserRole
from db.models.pipeline import Pipeline
from db.models.user import User
from engines import EngineFactory
from schemas.common import Envelope, Page
from schemas.pipeline import (
    PipelineCreate,
    PipelineRead,
    PipelineStatusResponse,
    PipelineUpdate,
)
from schemas.run import RunRead

router = APIRouter(prefix="/pipelines", tags=["pipelines"])

_de_plus = require_role(
    UserRole.data_engineer, UserRole.architect, UserRole.manager, UserRole.admin
)


async def _get_or_404(db: AsyncSession, pipeline_id: uuid.UUID) -> Pipeline:
    pipeline = await crud_pipeline.get(db, pipeline_id)
    if pipeline is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pipeline not found")
    return pipeline


@router.get("", response_model=Envelope[Page[PipelineRead]])
async def list_pipelines(
    env_id: uuid.UUID | None = Query(default=None),
    request_id: uuid.UUID | None = Query(default=None),
    status_filter: PipelineStatus | None = Query(default=None, alias="status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_de_plus),
) -> Envelope[Page[PipelineRead]]:
    filters: dict = {}
    if env_id is not None:
        filters["env_id"] = env_id
    if request_id is not None:
        filters["request_id"] = request_id
    if status_filter is not None:
        filters["status"] = status_filter
    items, total = await crud_pipeline.get_multi(
        db, page=page, page_size=page_size, filters=filters
    )
    return Envelope(
        data=Page(
            items=[PipelineRead.model_validate(p) for p in items],
            total=total,
            page=page,
            page_size=page_size,
        ),
        message="",
    )


@router.post("", response_model=Envelope[PipelineRead], status_code=status.HTTP_201_CREATED)
async def create_pipeline(
    body: PipelineCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(_de_plus),
) -> Envelope[PipelineRead]:
    if await crud_pipeline.get_by_name_env(db, body.name, body.env_id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A pipeline with this name already exists in this environment",
        )
    if body.request_id is not None:
        req = await crud_request.get(db, body.request_id)
        if req is None or req.status != RequestStatus.approved:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="A pipeline must link to an approved request",
            )
    data = body.model_dump()
    data["created_by"] = current_user.id
    pipeline = await crud_pipeline.create(db, data)
    await db.commit()
    return Envelope(data=PipelineRead.model_validate(pipeline), message="Pipeline created")


@router.get("/{pipeline_id}", response_model=Envelope[PipelineRead])
async def get_pipeline(
    pipeline_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_de_plus),
) -> Envelope[PipelineRead]:
    pipeline = await _get_or_404(db, pipeline_id)
    return Envelope(data=PipelineRead.model_validate(pipeline), message="")


@router.patch("/{pipeline_id}", response_model=Envelope[PipelineRead])
async def update_pipeline(
    pipeline_id: uuid.UUID,
    body: PipelineUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_de_plus),
) -> Envelope[PipelineRead]:
    pipeline = await _get_or_404(db, pipeline_id)
    changes = body.model_dump(exclude_unset=True)
    if "name" in changes:
        existing = await crud_pipeline.get_by_name_env(db, changes["name"], pipeline.env_id)
        if existing is not None and existing.id != pipeline.id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A pipeline with this name already exists in this environment",
            )
    pipeline = await crud_pipeline.update(db, pipeline, changes)
    await db.commit()
    return Envelope(data=PipelineRead.model_validate(pipeline), message="Pipeline updated")


@router.delete("/{pipeline_id}", response_model=Envelope[None])
async def delete_pipeline(
    pipeline_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_de_plus),
) -> Envelope[None]:
    pipeline = await _get_or_404(db, pipeline_id)
    await crud_pipeline.soft_delete(db, pipeline)
    await db.commit()
    return Envelope(data=None, message="Pipeline deleted")


@router.post("/{pipeline_id}/run", response_model=Envelope[RunRead], status_code=status.HTTP_201_CREATED)
async def run_pipeline(
    pipeline_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(_de_plus),
) -> Envelope[RunRead]:
    pipeline = await _get_or_404(db, pipeline_id)
    if pipeline.status == PipelineStatus.paused:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Cannot run a paused pipeline"
        )
    # Persist the run as queued first (AC: created with status queued), then let the
    # engine stub complete it immediately (PRD decision 3).
    run = await crud_pipeline_run.create(
        db,
        {
            "pipeline_id": pipeline.id,
            "triggered_by": current_user.id,
            "status": RunStatus.queued,
            "logs": [],
            "run_metadata": {},
        },
    )
    engine = EngineFactory.create(pipeline.engine)
    result = engine.trigger(pipeline)
    run = await crud_pipeline_run.update(
        db,
        run,
        {
            "status": result.status,
            "started_at": result.started_at,
            "ended_at": result.ended_at,
            "duration_seconds": result.duration_seconds,
            "rows_processed": result.rows_processed,
            "bytes_processed": result.bytes_processed,
            "error_message": result.error_message,
            "logs": result.logs,
            "run_metadata": result.run_metadata,
        },
    )
    await db.commit()
    return Envelope(data=RunRead.model_validate(run), message="Run triggered")


@router.post("/{pipeline_id}/pause", response_model=Envelope[PipelineRead])
async def pause_pipeline(
    pipeline_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_de_plus),
) -> Envelope[PipelineRead]:
    pipeline = await _get_or_404(db, pipeline_id)
    if pipeline.status != PipelineStatus.active:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot pause a pipeline in status '{pipeline.status.value}'",
        )
    pipeline = await crud_pipeline.update(db, pipeline, {"status": PipelineStatus.paused})
    await db.commit()
    return Envelope(data=PipelineRead.model_validate(pipeline), message="Pipeline paused")


@router.post("/{pipeline_id}/resume", response_model=Envelope[PipelineRead])
async def resume_pipeline(
    pipeline_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_de_plus),
) -> Envelope[PipelineRead]:
    pipeline = await _get_or_404(db, pipeline_id)
    if pipeline.status != PipelineStatus.paused:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot resume a pipeline in status '{pipeline.status.value}'",
        )
    pipeline = await crud_pipeline.update(db, pipeline, {"status": PipelineStatus.active})
    await db.commit()
    return Envelope(data=PipelineRead.model_validate(pipeline), message="Pipeline resumed")


@router.get("/{pipeline_id}/status", response_model=Envelope[PipelineStatusResponse])
async def pipeline_status(
    pipeline_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_de_plus),
) -> Envelope[PipelineStatusResponse]:
    pipeline = await _get_or_404(db, pipeline_id)
    latest = await crud_pipeline_run.latest_for_pipeline(db, pipeline.id)
    return Envelope(
        data=PipelineStatusResponse(
            pipeline_id=pipeline.id,
            status=pipeline.status,
            latest_run=RunRead.model_validate(latest) if latest else None,
        ),
        message="",
    )


@router.get("/{pipeline_id}/runs", response_model=Envelope[Page[RunRead]])
async def pipeline_runs(
    pipeline_id: uuid.UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_de_plus),
) -> Envelope[Page[RunRead]]:
    await _get_or_404(db, pipeline_id)
    items, total = await crud_pipeline_run.list_filtered(
        db, page=page, page_size=page_size, pipeline_id=pipeline_id
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
