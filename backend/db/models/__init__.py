"""ORM model registry.

Import every model module here so SQLAlchemy metadata (and Alembic autogenerate)
sees all tables. Models are added in Phase 1 (GLD-3); this package is intentionally
empty during scaffolding.
"""
from db.base import Base  # noqa: F401

__all__ = ["Base"]
