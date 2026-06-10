"""Environment model (PROJECT_SPEC §4.1, §9).

Environments (dev / staging / prod) scope every other record via ``env_id``.
Not soft-deleted — environments are long-lived and referenced by FK.
"""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from db.base import Base
from db.mixins import UUIDPKMixin


class Environment(UUIDPKMixin, Base):
    __tablename__ = "environments"

    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    base_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    description: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
