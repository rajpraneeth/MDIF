"""Domain enumerations (PROJECT_SPEC §4).

Stored as ``VARCHAR`` with a ``CHECK`` constraint (``native_enum=False``) rather
than native Postgres ``ENUM`` types — this keeps migrations simple and avoids the
``ALTER TYPE`` pain when values evolve, while still validating at the DB layer.
Use :func:`enum_type` when declaring an enum column on a model.
"""
from __future__ import annotations

import enum

from sqlalchemy import Enum as SAEnum


class UserRole(str, enum.Enum):
    requester = "requester"
    data_engineer = "data_engineer"
    architect = "architect"
    manager = "manager"
    admin = "admin"


class ConnectionType(str, enum.Enum):
    sql_server = "sql_server"
    adls_gen2 = "adls_gen2"
    s3 = "s3"
    snowflake = "snowflake"
    kafka = "kafka"
    rest_api = "rest_api"
    databricks_catalog = "databricks_catalog"


class SchemaObjectType(str, enum.Enum):
    table = "table"
    view = "view"
    topic = "topic"
    endpoint = "endpoint"
    file_path = "file_path"


class RequestPriority(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class RequestStatus(str, enum.Enum):
    draft = "draft"
    submitted = "submitted"
    under_review = "under_review"
    approved = "approved"
    rejected = "rejected"
    in_progress = "in_progress"
    completed = "completed"


class IngestionMode(str, enum.Enum):
    full = "full"
    incremental = "incremental"
    cdc = "cdc"


class PipelineEngine(str, enum.Enum):
    adf = "adf"
    databricks = "databricks"
    python_script = "python_script"
    pyspark_script = "pyspark_script"


class PipelineStatus(str, enum.Enum):
    draft = "draft"
    active = "active"
    paused = "paused"
    deleted = "deleted"


class RunStatus(str, enum.Enum):
    queued = "queued"
    running = "running"
    succeeded = "succeeded"
    failed = "failed"
    cancelled = "cancelled"


class PromotionStatus(str, enum.Enum):
    pending = "pending"
    in_progress = "in_progress"
    completed = "completed"
    failed = "failed"


def enum_type(py_enum: type[enum.Enum], name: str) -> SAEnum:
    """Build a non-native (VARCHAR + CHECK) SQLAlchemy Enum for ``py_enum``.

    ``name`` is the constraint name used in migrations for stable up/down.
    """
    return SAEnum(
        py_enum,
        name=name,
        native_enum=False,
        length=32,
        values_callable=lambda members: [m.value for m in members],
    )
