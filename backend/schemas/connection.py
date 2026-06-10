"""Connection schemas (PROJECT_SPEC §5 Connections, §10, PRD decision 6).

``config`` holds secret *references* only (e.g. ``{"secret_ref": "CONN_SQL_PWD"}``),
never raw secret values. It is returned as stored and never resolved on GET
(PRD decision 6); secret resolution lands in a later phase.
"""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from db.enums import ConnectionType


class ConnectionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    type: ConnectionType
    config: dict
    env_id: uuid.UUID
    created_by: uuid.UUID | None = None
    created_at: datetime
    updated_at: datetime


class ConnectionCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    type: ConnectionType
    env_id: uuid.UUID
    config: dict = Field(default_factory=dict)


class ConnectionUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    type: ConnectionType | None = None
    config: dict | None = None


class ConnectionTestResult(BaseModel):
    """Stub result of a connection test (PROJECT_SPEC §5)."""

    success: bool
    latency_ms: int
