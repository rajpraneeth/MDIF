"""Environment-promotion schemas (PROJECT_SPEC §5 Promotions, §9, §11 Prompt 7).

A promotion captures a secret-free JSONB snapshot of selected requests + pipelines
from a source environment; ``execute`` idempotently upserts them into the target
environment (match by name/title + ``env_id``). Secrets are never snapshotted —
``target_connection_id`` and any secret-bearing ``engine_config`` keys are nulled.
"""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from db.enums import PromotionStatus


class PromotionCreate(BaseModel):
    source_env_id: uuid.UUID
    target_env_id: uuid.UUID
    request_ids: list[uuid.UUID] = Field(default_factory=list)
    pipeline_ids: list[uuid.UUID] = Field(default_factory=list)

    @model_validator(mode="after")
    def _distinct_envs(self) -> "PromotionCreate":
        if self.source_env_id == self.target_env_id:
            raise ValueError("source_env_id and target_env_id must differ")
        if not self.request_ids and not self.pipeline_ids:
            raise ValueError("select at least one request or pipeline to promote")
        return self


class PromotionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    source_env_id: uuid.UUID
    target_env_id: uuid.UUID
    request_ids: list = Field(default_factory=list)
    pipeline_ids: list = Field(default_factory=list)
    snapshot: dict = Field(default_factory=dict)
    status: PromotionStatus
    promoted_by: uuid.UUID | None = None
    created_at: datetime
    completed_at: datetime | None = None
    error_message: str | None = None
