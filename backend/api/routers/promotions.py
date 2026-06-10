"""Environment-promotion routes (PROJECT_SPEC §5 Promotions, §9, §11 Prompt 7).

Admin-only. A promotion is created against a *source* env with a selection of
request/pipeline ids; creation captures a secret-free JSONB **snapshot**.
``execute`` idempotently upserts that snapshot into the *target* env, matching
existing rows by title/name + ``env_id`` so re-running is safe (the AC).

Secrets never enter the snapshot: ``target_connection_id`` (env-scoped, secret-
bearing via the connection's ``secret_ref``) is dropped, and secret-ish keys in a
pipeline's ``engine_config`` are nulled (§10).
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.dependencies import require_role
from db.base import get_db
from db.crud.environment import crud_environment
from db.crud.pipeline import crud_pipeline
from db.crud.promotion import crud_promotion
from db.crud.request import crud_request
from db.enums import PromotionStatus, UserRole
from db.models.env_promotion import EnvPromotion
from db.models.user import User
from schemas.common import Envelope, Page
from schemas.promotion import PromotionCreate, PromotionRead

router = APIRouter(prefix="/promotions", tags=["promotions"])

_admin_only = require_role(UserRole.admin)

# engine_config keys we refuse to carry across an environment boundary (§10).
_SECRET_KEYS = {"password", "secret", "token", "key", "secret_ref", "credential"}


def _strip_secrets(config: dict | None) -> dict:
    """Null any secret-ish keys in a pipeline ``engine_config`` for the snapshot."""
    if not config:
        return {}
    return {k: (None if k.lower() in _SECRET_KEYS else v) for k, v in config.items()}


def _serialize(p: EnvPromotion) -> PromotionRead:
    return PromotionRead.model_validate(p)


@router.get("", response_model=Envelope[Page[PromotionRead]])
async def list_promotions(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_admin_only),
) -> Envelope[Page[PromotionRead]]:
    items, total = await crud_promotion.get_multi(db, page=page, page_size=page_size)
    return Envelope(
        data=Page(
            items=[_serialize(p) for p in items],
            total=total,
            page=page,
            page_size=page_size,
        ),
        message="",
    )


@router.post("", response_model=Envelope[PromotionRead], status_code=status.HTTP_201_CREATED)
async def create_promotion(
    body: PromotionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(_admin_only),
) -> Envelope[PromotionRead]:
    # Both environments must exist.
    if await crud_environment.get(db, body.source_env_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source environment not found")
    if await crud_environment.get(db, body.target_env_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target environment not found")

    # Resolve and validate selections against the SOURCE env, then snapshot.
    req_snapshot: list[dict] = []
    for rid in body.request_ids:
        req = await crud_request.get(db, rid)
        if req is None or req.env_id != body.source_env_id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Request {rid} does not belong to the source environment",
            )
        req_snapshot.append(
            {
                "source_id": str(req.id),
                "title": req.title,
                "description": req.description,
                "priority": req.priority.value,
                "status": req.status.value,
                "requested_by": str(req.requested_by),
                "source_objects": req.source_objects,
                "target_schema": req.target_schema,
                "target_table_pattern": req.target_table_pattern,
                "ingestion_mode": req.ingestion_mode.value,
                "schedule_cron": req.schedule_cron,
                "tags": req.tags,
                # target_connection_id intentionally omitted — env-scoped + secret-bearing.
            }
        )

    pipe_snapshot: list[dict] = []
    for pid in body.pipeline_ids:
        pipe = await crud_pipeline.get(db, pid)
        if pipe is None or pipe.env_id != body.source_env_id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Pipeline {pid} does not belong to the source environment",
            )
        # Carry the linked request's title so execute can re-point request_id in the target.
        linked_title = None
        if pipe.request_id is not None:
            linked = await crud_request.get(db, pipe.request_id)
            linked_title = linked.title if linked is not None else None
        pipe_snapshot.append(
            {
                "source_id": str(pipe.id),
                "name": pipe.name,
                "description": pipe.description,
                "engine": pipe.engine.value,
                "engine_config": _strip_secrets(pipe.engine_config),
                "status": pipe.status.value,
                "created_by": str(pipe.created_by) if pipe.created_by else None,
                "request_title": linked_title,
            }
        )

    promo = await crud_promotion.create(
        db,
        {
            "source_env_id": body.source_env_id,
            "target_env_id": body.target_env_id,
            "request_ids": [str(r) for r in body.request_ids],
            "pipeline_ids": [str(p) for p in body.pipeline_ids],
            "snapshot": {"requests": req_snapshot, "pipelines": pipe_snapshot},
            "status": PromotionStatus.pending,
            "promoted_by": current_user.id,
        },
    )
    await db.commit()
    return Envelope(data=_serialize(promo), message="Promotion created")


@router.get("/{promotion_id}", response_model=Envelope[PromotionRead])
async def get_promotion(
    promotion_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_admin_only),
) -> Envelope[PromotionRead]:
    promo = await crud_promotion.get(db, promotion_id)
    if promo is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Promotion not found")
    return Envelope(data=_serialize(promo), message="")


@router.post("/{promotion_id}/execute", response_model=Envelope[PromotionRead])
async def execute_promotion(
    promotion_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_admin_only),
) -> Envelope[PromotionRead]:
    promo = await crud_promotion.get(db, promotion_id)
    if promo is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Promotion not found")
    # Guard against a concurrent in-flight execute; re-running a completed/failed
    # promotion is allowed and idempotent (the AC).
    if promo.status == PromotionStatus.in_progress:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Promotion is already executing",
        )

    target_env = promo.target_env_id
    promo = await crud_promotion.update(db, promo, {"status": PromotionStatus.in_progress})

    try:
        snapshot = promo.snapshot or {}
        # Upsert requests first; remember title→target_id to re-point pipelines.
        title_to_target: dict[str, uuid.UUID] = {}
        for entry in snapshot.get("requests", []):
            fields = {
                "title": entry["title"],
                "description": entry.get("description"),
                "priority": entry["priority"],
                "status": entry["status"],
                "requested_by": uuid.UUID(entry["requested_by"]),
                "env_id": target_env,
                "source_objects": entry.get("source_objects") or [],
                "target_connection_id": None,  # secrets excluded across envs.
                "target_schema": entry.get("target_schema"),
                "target_table_pattern": entry.get("target_table_pattern"),
                "ingestion_mode": entry["ingestion_mode"],
                "schedule_cron": entry.get("schedule_cron"),
                "tags": entry.get("tags") or [],
            }
            existing = await crud_request.get_by_title_env(db, entry["title"], target_env)
            if existing is None:
                created = await crud_request.create(db, fields)
                title_to_target[entry["title"]] = created.id
            else:
                updated = await crud_request.update(db, existing, fields)
                title_to_target[entry["title"]] = updated.id

        # Upsert pipelines, re-pointing request_id into the target env where possible.
        for entry in snapshot.get("pipelines", []):
            req_title = entry.get("request_title")
            target_request_id = title_to_target.get(req_title) if req_title else None
            fields = {
                "name": entry["name"],
                "description": entry.get("description"),
                "engine": entry["engine"],
                "engine_config": entry.get("engine_config") or {},
                "status": entry["status"],
                "created_by": uuid.UUID(entry["created_by"]) if entry.get("created_by") else None,
                "env_id": target_env,
                "request_id": target_request_id,
            }
            existing_p = await crud_pipeline.get_by_name_env(db, entry["name"], target_env)
            if existing_p is None:
                await crud_pipeline.create(db, fields)
            else:
                await crud_pipeline.update(db, existing_p, fields)

        promo = await crud_promotion.update(
            db,
            promo,
            {
                "status": PromotionStatus.completed,
                "completed_at": datetime.now(timezone.utc),
                "error_message": None,
            },
        )
        await db.commit()
    except Exception as exc:  # noqa: BLE001 — record failure on the promotion, surface 500.
        await db.rollback()
        promo = await crud_promotion.get(db, promotion_id)
        if promo is not None:
            await crud_promotion.update(
                db, promo, {"status": PromotionStatus.failed, "error_message": str(exc)}
            )
            await db.commit()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Promotion execution failed: {exc}",
        )

    return Envelope(data=_serialize(promo), message="Promotion executed")
