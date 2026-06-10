"""Environment promotion model (PROJECT_SPEC §4.1, §9).

Captures a JSON snapshot of selected requests/pipelines (secrets excluded) at
promotion time; ``execute`` idempotently upserts them into the target env.
"""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from db.base import Base
from db.enums import PromotionStatus, enum_type
from db.mixins import UUIDPKMixin


class EnvPromotion(UUIDPKMixin, Base):
    __tablename__ = "env_promotions"

    source_env_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("environments.id"), nullable=False
    )
    target_env_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("environments.id"), nullable=False
    )
    request_ids: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    pipeline_ids: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    snapshot: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    status: Mapped[PromotionStatus] = mapped_column(
        enum_type(PromotionStatus, "promotion_status"),
        nullable=False,
        default=PromotionStatus.pending,
        index=True,
    )
    promoted_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
