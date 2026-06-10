"""Ingestion request model (PROJECT_SPEC §4.1, §8 flow).

``source_objects`` is a JSONB array of ``{schema_object_id, alias, filter_config}``
entries (§4.2). ``rejection_reason`` backs the reject endpoint (§5).
"""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import Base
from db.enums import IngestionMode, RequestPriority, RequestStatus, enum_type
from db.mixins import SoftDeleteMixin, TimestampMixin, UUIDPKMixin


class IngestionRequest(UUIDPKMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "ingestion_requests"

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    priority: Mapped[RequestPriority] = mapped_column(
        enum_type(RequestPriority, "request_priority"),
        nullable=False,
        default=RequestPriority.medium,
    )
    status: Mapped[RequestStatus] = mapped_column(
        enum_type(RequestStatus, "request_status"),
        nullable=False,
        default=RequestStatus.draft,
        index=True,
    )
    requested_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    approved_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    approved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    env_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("environments.id"), nullable=False, index=True
    )
    source_objects: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    target_connection_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("connections.id"), nullable=True
    )
    target_schema: Mapped[str | None] = mapped_column(String(255), nullable=True)
    target_table_pattern: Mapped[str | None] = mapped_column(String(255), nullable=True)
    ingestion_mode: Mapped[IngestionMode] = mapped_column(
        enum_type(IngestionMode, "ingestion_mode"),
        nullable=False,
        default=IngestionMode.full,
    )
    schedule_cron: Mapped[str | None] = mapped_column(String(120), nullable=True)
    tags: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)

    pipelines: Mapped[list["Pipeline"]] = relationship(back_populates="request")
