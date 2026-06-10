"""Schema object registry (PROJECT_SPEC §4.1).

User-selectable source objects discovered from a connection (tables, views,
topics, endpoints, file paths). Refreshed by the connection ``/discover`` flow.
"""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import Base
from db.enums import SchemaObjectType, enum_type
from db.mixins import TimestampMixin, UUIDPKMixin


class SchemaObject(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "schema_objects"

    connection_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("connections.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    database_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    schema_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    object_name: Mapped[str] = mapped_column(String(255), nullable=False)
    object_type: Mapped[SchemaObjectType] = mapped_column(
        enum_type(SchemaObjectType, "schema_object_type"), nullable=False
    )
    columns: Mapped[list | None] = mapped_column(JSONB, nullable=True, default=list)
    row_count: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    last_profiled_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    connection: Mapped["Connection"] = relationship(back_populates="schema_objects")
