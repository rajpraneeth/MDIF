"""initial_schema

Creates the full MDIF v1 data model (PROJECT_SPEC §4): environments, users,
connections, schema_objects, ingestion_requests, pipelines, pipeline_runs,
env_promotions. Enum columns are VARCHAR + CHECK (native_enum=False) and reuse
``db.enums.enum_type`` so the constraints match the ORM exactly.

PRD decision 5: partial unique indexes on (name, env_id) WHERE deleted_at IS NULL
for connections and pipelines.

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-06-10
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

from db.enums import (
    ConnectionType,
    IngestionMode,
    PipelineEngine,
    PipelineStatus,
    PromotionStatus,
    RequestPriority,
    RequestStatus,
    RunStatus,
    SchemaObjectType,
    UserRole,
    enum_type,
)

revision: str = "0001_initial_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _uuid() -> postgresql.UUID:
    return postgresql.UUID(as_uuid=True)


def _now() -> sa.TextClause:
    return sa.text("now()")


def upgrade() -> None:
    op.create_table(
        "environments",
        sa.Column("id", _uuid(), primary_key=True),
        sa.Column("name", sa.String(length=100), nullable=False, unique=True),
        sa.Column("base_url", sa.String(length=500), nullable=True),
        sa.Column("description", sa.String(length=1000), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=_now(), nullable=False),
    )

    op.create_table(
        "users",
        sa.Column("id", _uuid(), primary_key=True),
        sa.Column("email", sa.String(length=320), nullable=False, unique=True),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.Column("full_name", sa.String(length=255), nullable=True),
        sa.Column("role", enum_type(UserRole, "user_role"), nullable=False, server_default=UserRole.requester.value),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("env_id", _uuid(), sa.ForeignKey("environments.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=_now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=_now(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_users_email", "users", ["email"])
    op.create_index("ix_users_env_id", "users", ["env_id"])

    op.create_table(
        "connections",
        sa.Column("id", _uuid(), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("type", enum_type(ConnectionType, "connection_type"), nullable=False),
        sa.Column("config", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("env_id", _uuid(), sa.ForeignKey("environments.id"), nullable=False),
        sa.Column("created_by", _uuid(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=_now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=_now(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_connections_env_id", "connections", ["env_id"])
    op.create_index(
        "uq_connections_name_env_live",
        "connections",
        ["name", "env_id"],
        unique=True,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )

    op.create_table(
        "schema_objects",
        sa.Column("id", _uuid(), primary_key=True),
        sa.Column("connection_id", _uuid(), sa.ForeignKey("connections.id", ondelete="CASCADE"), nullable=False),
        sa.Column("database_name", sa.String(length=255), nullable=True),
        sa.Column("schema_name", sa.String(length=255), nullable=True),
        sa.Column("object_name", sa.String(length=255), nullable=False),
        sa.Column("object_type", enum_type(SchemaObjectType, "schema_object_type"), nullable=False),
        sa.Column("columns", postgresql.JSONB(), nullable=True),
        sa.Column("row_count", sa.BigInteger(), nullable=True),
        sa.Column("last_profiled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=_now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=_now(), nullable=False),
    )
    op.create_index("ix_schema_objects_connection_id", "schema_objects", ["connection_id"])

    op.create_table(
        "ingestion_requests",
        sa.Column("id", _uuid(), primary_key=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("priority", enum_type(RequestPriority, "request_priority"), nullable=False, server_default=RequestPriority.medium.value),
        sa.Column("status", enum_type(RequestStatus, "request_status"), nullable=False, server_default=RequestStatus.draft.value),
        sa.Column("requested_by", _uuid(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("approved_by", _uuid(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("rejection_reason", sa.Text(), nullable=True),
        sa.Column("env_id", _uuid(), sa.ForeignKey("environments.id"), nullable=False),
        sa.Column("source_objects", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("target_connection_id", _uuid(), sa.ForeignKey("connections.id"), nullable=True),
        sa.Column("target_schema", sa.String(length=255), nullable=True),
        sa.Column("target_table_pattern", sa.String(length=255), nullable=True),
        sa.Column("ingestion_mode", enum_type(IngestionMode, "ingestion_mode"), nullable=False, server_default=IngestionMode.full.value),
        sa.Column("schedule_cron", sa.String(length=120), nullable=True),
        sa.Column("tags", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=_now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=_now(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_ingestion_requests_status", "ingestion_requests", ["status"])
    op.create_index("ix_ingestion_requests_requested_by", "ingestion_requests", ["requested_by"])
    op.create_index("ix_ingestion_requests_env_id", "ingestion_requests", ["env_id"])

    op.create_table(
        "pipelines",
        sa.Column("id", _uuid(), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("request_id", _uuid(), sa.ForeignKey("ingestion_requests.id"), nullable=True),
        sa.Column("engine", enum_type(PipelineEngine, "pipeline_engine"), nullable=False),
        sa.Column("engine_config", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("status", enum_type(PipelineStatus, "pipeline_status"), nullable=False, server_default=PipelineStatus.draft.value),
        sa.Column("created_by", _uuid(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("env_id", _uuid(), sa.ForeignKey("environments.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=_now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=_now(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_pipelines_request_id", "pipelines", ["request_id"])
    op.create_index("ix_pipelines_status", "pipelines", ["status"])
    op.create_index("ix_pipelines_env_id", "pipelines", ["env_id"])
    op.create_index(
        "uq_pipelines_name_env_live",
        "pipelines",
        ["name", "env_id"],
        unique=True,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )

    op.create_table(
        "pipeline_runs",
        sa.Column("id", _uuid(), primary_key=True),
        sa.Column("pipeline_id", _uuid(), sa.ForeignKey("pipelines.id", ondelete="CASCADE"), nullable=False),
        sa.Column("triggered_by", _uuid(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("status", enum_type(RunStatus, "run_status"), nullable=False, server_default=RunStatus.queued.value),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("duration_seconds", sa.Integer(), nullable=True),
        sa.Column("rows_processed", sa.BigInteger(), nullable=True),
        sa.Column("bytes_processed", sa.BigInteger(), nullable=True),
        sa.Column("logs", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("run_metadata", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=_now(), nullable=False),
    )
    op.create_index("ix_pipeline_runs_pipeline_id", "pipeline_runs", ["pipeline_id"])
    op.create_index("ix_pipeline_runs_status", "pipeline_runs", ["status"])

    op.create_table(
        "env_promotions",
        sa.Column("id", _uuid(), primary_key=True),
        sa.Column("source_env_id", _uuid(), sa.ForeignKey("environments.id"), nullable=False),
        sa.Column("target_env_id", _uuid(), sa.ForeignKey("environments.id"), nullable=False),
        sa.Column("request_ids", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("pipeline_ids", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("snapshot", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("status", enum_type(PromotionStatus, "promotion_status"), nullable=False, server_default=PromotionStatus.pending.value),
        sa.Column("promoted_by", _uuid(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=_now(), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
    )
    op.create_index("ix_env_promotions_status", "env_promotions", ["status"])


def downgrade() -> None:
    op.drop_table("env_promotions")
    op.drop_table("pipeline_runs")
    op.drop_table("pipelines")
    op.drop_table("ingestion_requests")
    op.drop_table("schema_objects")
    op.drop_table("connections")
    op.drop_table("users")
    op.drop_table("environments")
