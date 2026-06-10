"""Ingestion-request schemas (PROJECT_SPEC §4.2, §5 Requests, §8 flow)."""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from db.enums import IngestionMode, RequestPriority, RequestStatus


class SourceObjectEntry(BaseModel):
    """One entry in ``source_objects`` (§4.2)."""

    schema_object_id: uuid.UUID
    alias: str | None = None
    filter_config: dict | None = None


class RequestRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    description: str | None = None
    priority: RequestPriority
    status: RequestStatus
    requested_by: uuid.UUID
    approved_by: uuid.UUID | None = None
    approved_at: datetime | None = None
    rejection_reason: str | None = None
    env_id: uuid.UUID
    source_objects: list = Field(default_factory=list)
    target_connection_id: uuid.UUID | None = None
    target_schema: str | None = None
    target_table_pattern: str | None = None
    ingestion_mode: IngestionMode
    schedule_cron: str | None = None
    tags: list = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class RequestCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    env_id: uuid.UUID
    description: str | None = None
    priority: RequestPriority = RequestPriority.medium
    source_objects: list[SourceObjectEntry] = Field(default_factory=list)
    target_connection_id: uuid.UUID | None = None
    target_schema: str | None = Field(default=None, max_length=255)
    target_table_pattern: str | None = Field(default=None, max_length=255)
    ingestion_mode: IngestionMode = IngestionMode.full
    schedule_cron: str | None = Field(default=None, max_length=120)
    tags: list[str] = Field(default_factory=list)


class RequestUpdate(BaseModel):
    """Editable while the request is still a draft."""

    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    priority: RequestPriority | None = None
    source_objects: list[SourceObjectEntry] | None = None
    target_connection_id: uuid.UUID | None = None
    target_schema: str | None = Field(default=None, max_length=255)
    target_table_pattern: str | None = Field(default=None, max_length=255)
    ingestion_mode: IngestionMode | None = None
    schedule_cron: str | None = Field(default=None, max_length=120)
    tags: list[str] | None = None


class RejectRequest(BaseModel):
    reason: str = Field(min_length=1, max_length=2000)
