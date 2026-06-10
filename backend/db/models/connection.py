"""Connection model (PROJECT_SPEC §4.1).

``config`` JSONB stores secrets as references (``{"secret_ref": "CONN_SQL_PWD"}``),
never raw values (§10). PRD decision 5: partial unique index on (name, env_id)
WHERE deleted_at IS NULL — defined in the Alembic migration.
"""
from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import Base
from db.enums import ConnectionType, enum_type
from db.mixins import SoftDeleteMixin, TimestampMixin, UUIDPKMixin


class Connection(UUIDPKMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "connections"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    type: Mapped[ConnectionType] = mapped_column(
        enum_type(ConnectionType, "connection_type"), nullable=False
    )
    config: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    env_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("environments.id"), nullable=False, index=True
    )
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )

    schema_objects: Mapped[list["SchemaObject"]] = relationship(
        back_populates="connection", cascade="all, delete-orphan"
    )
