"""Environment schemas (PROJECT_SPEC §5 Environments)."""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class EnvironmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    base_url: str | None = None
    description: str | None = None
    is_active: bool
    created_at: datetime


class EnvironmentCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    base_url: str | None = Field(default=None, max_length=500)
    description: str | None = Field(default=None, max_length=1000)
    is_active: bool = True


class EnvironmentUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    base_url: str | None = Field(default=None, max_length=500)
    description: str | None = Field(default=None, max_length=1000)
    is_active: bool | None = None
