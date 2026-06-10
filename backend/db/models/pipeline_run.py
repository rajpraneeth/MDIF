"""Pipeline run model (PROJECT_SPEC §4.1).

One row per engine trigger. ``logs`` and ``run_metadata`` are JSONB; metrics are
populated by the engine adapter (stubs complete immediately — PRD decision 3).
"""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, Integer, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import Base
from db.enums import RunStatus, enum_type
from db.mixins import UUIDPKMixin


class PipelineRun(UUIDPKMixin, Base):
    __tablename__ = "pipeline_runs"

    pipeline_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("pipelines.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    triggered_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    status: Mapped[RunStatus] = mapped_column(
        enum_type(RunStatus, "run_status"),
        nullable=False,
        default=RunStatus.queued,
        index=True,
    )
    started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    ended_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    rows_processed: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    bytes_processed: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    logs: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    run_metadata: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    pipeline: Mapped["Pipeline"] = relationship(back_populates="runs")
