"""Pipeline schemas (PROJECT_SPEC §5 Pipelines)."""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from db.enums import PipelineEngine, PipelineStatus
from schemas.run import RunRead


class PipelineRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    description: str | None = None
    request_id: uuid.UUID | None = None
    engine: PipelineEngine
    engine_config: dict
    status: PipelineStatus
    created_by: uuid.UUID | None = None
    env_id: uuid.UUID
    created_at: datetime
    updated_at: datetime


class PipelineCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    engine: PipelineEngine
    env_id: uuid.UUID
    description: str | None = None
    request_id: uuid.UUID | None = None
    engine_config: dict = Field(default_factory=dict)


class PipelineUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    engine: PipelineEngine | None = None
    engine_config: dict | None = None


class PipelineStatusResponse(BaseModel):
    """``GET /pipelines/{id}/status`` — for the 15s PipelineStatusBadge poll."""

    pipeline_id: uuid.UUID
    status: PipelineStatus
    latest_run: RunRead | None = None
