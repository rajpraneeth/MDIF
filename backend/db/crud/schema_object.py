"""Schema-object CRUD (PROJECT_SPEC §5)."""
from __future__ import annotations

import uuid
from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.crud.base import CRUDBase
from db.models.schema_object import SchemaObject


class CRUDSchemaObject(CRUDBase[SchemaObject]):
    async def list_for_connection(
        self, db: AsyncSession, connection_id: uuid.UUID
    ) -> Sequence[SchemaObject]:
        stmt = (
            select(SchemaObject)
            .where(SchemaObject.connection_id == connection_id)
            .order_by(
                SchemaObject.database_name,
                SchemaObject.schema_name,
                SchemaObject.object_name,
            )
        )
        return (await db.execute(stmt)).scalars().all()


crud_schema_object = CRUDSchemaObject(SchemaObject)
