"""User CRUD with email lookup (PROJECT_SPEC §5, §10)."""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.crud.base import CRUDBase
from db.models.user import User


class CRUDUser(CRUDBase[User]):
    async def get_by_email(
        self, db: AsyncSession, email: str, *, include_deleted: bool = False
    ) -> User | None:
        stmt = select(User).where(User.email == email)
        if not include_deleted:
            stmt = stmt.where(User.deleted_at.is_(None))
        return (await db.execute(stmt)).scalar_one_or_none()


crud_user = CRUDUser(User)
