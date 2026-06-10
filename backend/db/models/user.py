"""User model (PROJECT_SPEC §4.1, §3 RBAC, §10 Security)."""
from __future__ import annotations

import uuid

from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from db.base import Base
from db.enums import UserRole, enum_type
from db.mixins import SoftDeleteMixin, TimestampMixin, UUIDPKMixin


class User(UUIDPKMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    role: Mapped[UserRole] = mapped_column(
        enum_type(UserRole, "user_role"),
        nullable=False,
        default=UserRole.requester,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    env_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("environments.id"), nullable=True, index=True
    )
