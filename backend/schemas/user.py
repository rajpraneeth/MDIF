"""User schemas (PROJECT_SPEC §5 Users)."""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from db.enums import UserRole


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    # Plain str on read: input is already validated via UserCreate; re-validating
    # stored values on serialization would 500 a whole list over one legacy row.
    email: str
    full_name: str | None = None
    role: UserRole
    is_active: bool
    env_id: uuid.UUID | None = None
    created_at: datetime
    updated_at: datetime


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str | None = None
    role: UserRole = UserRole.requester
    is_active: bool = True
    env_id: uuid.UUID | None = None


class UserUpdate(BaseModel):
    """All fields optional — only provided fields are applied."""

    password: str | None = Field(default=None, min_length=8, max_length=128)
    full_name: str | None = None
    role: UserRole | None = None
    is_active: bool | None = None
    env_id: uuid.UUID | None = None
