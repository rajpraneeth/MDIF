"""Pipeline model (PROJECT_SPEC §4.1).

``engine_config`` JSONB shape varies by ``engine`` (§4.2). PRD decision 5: partial
unique index on (name, env_id) WHERE deleted_at IS NULL — in the Alembic migration.
"""
from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import Base
from db.enums import PipelineEngine, PipelineStatus, enum_type
from db.mixins import SoftDeleteMixin, TimestampMixin, UUIDPKMixin


class Pipeline(UUIDPKMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "pipelines"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    request_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ingestion_requests.id"), nullable=True, index=True
    )
    engine: Mapped[PipelineEngine] = mapped_column(
        enum_type(PipelineEngine, "pipeline_engine"), nullable=False
    )
    engine_config: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    status: Mapped[PipelineStatus] = mapped_column(
        enum_type(PipelineStatus, "pipeline_status"),
        nullable=False,
        default=PipelineStatus.draft,
        index=True,
    )
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    env_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("environments.id"), nullable=False, index=True
    )

    request: Mapped["IngestionRequest | None"] = relationship(back_populates="pipelines")
    runs: Mapped[list["PipelineRun"]] = relationship(
        back_populates="pipeline", cascade="all, delete-orphan"
    )
