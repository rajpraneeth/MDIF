"""Schema-object schemas + the discovery tree shape (PROJECT_SPEC §5)."""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from db.enums import SchemaObjectType


class SchemaObjectRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    connection_id: uuid.UUID
    database_name: str | None = None
    schema_name: str | None = None
    object_name: str
    object_type: SchemaObjectType
    columns: list | None = None
    row_count: int | None = None
    last_profiled_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class SchemaTreeObject(BaseModel):
    """A leaf object in the db→schema→object tree."""

    id: uuid.UUID
    object_name: str
    object_type: SchemaObjectType
    row_count: int | None = None


class SchemaTreeSchema(BaseModel):
    schema_name: str | None = None
    objects: list[SchemaTreeObject]


class SchemaTreeDatabase(BaseModel):
    database_name: str | None = None
    schemas: list[SchemaTreeSchema]


class SchemaObjectTree(BaseModel):
    """``GET /connections/{id}/objects`` payload: db → schema → object."""

    connection_id: uuid.UUID
    databases: list[SchemaTreeDatabase]
