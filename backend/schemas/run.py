"""Pipeline-run schemas (PROJECT_SPEC §5 Runs, §6 LogEntry)."""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from db.enums import RunStatus


class LogEntrySchema(BaseModel):
    timestamp: str
    level: str
    message: str


class RunRead(BaseModel):
    """Run summary (no logs — fetch those via ``/runs/{id}/logs``)."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    pipeline_id: uuid.UUID
    triggered_by: uuid.UUID | None = None
    status: RunStatus
    started_at: datetime | None = None
    ended_at: datetime | None = None
    duration_seconds: int | None = None
    rows_processed: int | None = None
    bytes_processed: int | None = None
    error_message: str | None = None
    run_metadata: dict = {}
    created_at: datetime
