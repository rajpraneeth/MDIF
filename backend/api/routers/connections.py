"""Connections routes (PROJECT_SPEC §5 Connections, §11 Prompt 3).

Env-scoped, soft-delete CRUD plus the ``test`` / ``discover`` stubs and the
db→schema→object discovery tree. Reads are open to any authenticated user;
writes require a non-requester role (data_engineer / architect / manager / admin).

Secrets: ``config`` carries only ``secret_ref`` references and is returned as
stored — never resolved on GET (PRD decision 6).
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.dependencies import get_current_user, require_role
from db.base import get_db
from db.crud.connection import crud_connection
from db.crud.schema_object import crud_schema_object
from db.enums import SchemaObjectType, UserRole
from db.models.user import User
from schemas.common import Envelope, Page
from schemas.connection import (
    ConnectionCreate,
    ConnectionRead,
    ConnectionTestResult,
    ConnectionUpdate,
)
from schemas.schema_object import (
    SchemaObjectRead,
    SchemaObjectTree,
    SchemaTreeDatabase,
    SchemaTreeObject,
    SchemaTreeSchema,
)

router = APIRouter(prefix="/connections", tags=["connections"])

# Writes are open to operators, not plain requesters.
_can_write = require_role(
    UserRole.data_engineer, UserRole.architect, UserRole.manager, UserRole.admin
)

# Fixed objects returned by the discover stub (PROJECT_SPEC §5: 3 fake objects).
_DISCOVER_STUB = [
    {
        "database_name": "sales_db",
        "schema_name": "dbo",
        "object_name": "customers",
        "object_type": SchemaObjectType.table,
        "columns": [
            {"name": "id", "type": "int"},
            {"name": "name", "type": "varchar"},
            {"name": "created_at", "type": "datetime"},
        ],
        "row_count": 1500,
    },
    {
        "database_name": "sales_db",
        "schema_name": "dbo",
        "object_name": "orders",
        "object_type": SchemaObjectType.table,
        "columns": [
            {"name": "id", "type": "int"},
            {"name": "customer_id", "type": "int"},
            {"name": "total", "type": "decimal"},
        ],
        "row_count": 8200,
    },
    {
        "database_name": "sales_db",
        "schema_name": "reporting",
        "object_name": "v_daily_sales",
        "object_type": SchemaObjectType.view,
        "columns": [
            {"name": "day", "type": "date"},
            {"name": "revenue", "type": "decimal"},
        ],
        "row_count": None,
    },
]


async def _get_or_404(db: AsyncSession, connection_id: uuid.UUID):
    conn = await crud_connection.get(db, connection_id)
    if conn is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Connection not found"
        )
    return conn


@router.get("", response_model=Envelope[Page[ConnectionRead]])
async def list_connections(
    env_id: uuid.UUID | None = Query(default=None),
    type: str | None = Query(default=None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> Envelope[Page[ConnectionRead]]:
    filters: dict = {}
    if env_id is not None:
        filters["env_id"] = env_id
    if type is not None:
        filters["type"] = type
    items, total = await crud_connection.get_multi(
        db, page=page, page_size=page_size, filters=filters
    )
    return Envelope(
        data=Page(
            items=[ConnectionRead.model_validate(c) for c in items],
            total=total,
            page=page,
            page_size=page_size,
        ),
        message="",
    )


@router.post(
    "", response_model=Envelope[ConnectionRead], status_code=status.HTTP_201_CREATED
)
async def create_connection(
    body: ConnectionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(_can_write),
) -> Envelope[ConnectionRead]:
    if await crud_connection.get_by_name_env(db, body.name, body.env_id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A connection with this name already exists in this environment",
        )
    data = body.model_dump()
    data["created_by"] = current_user.id
    conn = await crud_connection.create(db, data)
    await db.commit()
    return Envelope(data=ConnectionRead.model_validate(conn), message="Connection created")


@router.get("/{connection_id}", response_model=Envelope[ConnectionRead])
async def get_connection(
    connection_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> Envelope[ConnectionRead]:
    conn = await _get_or_404(db, connection_id)
    return Envelope(data=ConnectionRead.model_validate(conn), message="")


@router.patch("/{connection_id}", response_model=Envelope[ConnectionRead])
async def update_connection(
    connection_id: uuid.UUID,
    body: ConnectionUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_can_write),
) -> Envelope[ConnectionRead]:
    conn = await _get_or_404(db, connection_id)
    changes = body.model_dump(exclude_unset=True)
    if "name" in changes:
        existing = await crud_connection.get_by_name_env(db, changes["name"], conn.env_id)
        if existing is not None and existing.id != conn.id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A connection with this name already exists in this environment",
            )
    conn = await crud_connection.update(db, conn, changes)
    await db.commit()
    return Envelope(data=ConnectionRead.model_validate(conn), message="Connection updated")


@router.delete("/{connection_id}", response_model=Envelope[None])
async def delete_connection(
    connection_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_can_write),
) -> Envelope[None]:
    conn = await _get_or_404(db, connection_id)
    await crud_connection.soft_delete(db, conn)
    await db.commit()
    return Envelope(data=None, message="Connection deleted")


@router.post("/{connection_id}/test", response_model=Envelope[ConnectionTestResult])
async def test_connection(
    connection_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_can_write),
) -> Envelope[ConnectionTestResult]:
    await _get_or_404(db, connection_id)
    # Stub: real connectivity checks land with the engine adapters (v2).
    return Envelope(
        data=ConnectionTestResult(success=True, latency_ms=42),
        message="Connection test succeeded",
    )


@router.post(
    "/{connection_id}/discover",
    response_model=Envelope[list[SchemaObjectRead]],
    status_code=status.HTTP_201_CREATED,
)
async def discover_connection(
    connection_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_can_write),
) -> Envelope[list[SchemaObjectRead]]:
    await _get_or_404(db, connection_id)
    created = []
    for spec in _DISCOVER_STUB:
        obj = await crud_schema_object.create(db, {"connection_id": connection_id, **spec})
        created.append(obj)
    await db.commit()
    return Envelope(
        data=[SchemaObjectRead.model_validate(o) for o in created],
        message=f"Discovered {len(created)} objects",
    )


@router.get("/{connection_id}/objects", response_model=Envelope[SchemaObjectTree])
async def list_connection_objects(
    connection_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> Envelope[SchemaObjectTree]:
    await _get_or_404(db, connection_id)
    objects = await crud_schema_object.list_for_connection(db, connection_id)

    # Group ordered objects into database → schema → object.
    databases: list[SchemaTreeDatabase] = []
    db_index: dict[str | None, SchemaTreeDatabase] = {}
    schema_index: dict[tuple[str | None, str | None], SchemaTreeSchema] = {}
    for obj in objects:
        db_node = db_index.get(obj.database_name)
        if db_node is None:
            db_node = SchemaTreeDatabase(database_name=obj.database_name, schemas=[])
            db_index[obj.database_name] = db_node
            databases.append(db_node)
        skey = (obj.database_name, obj.schema_name)
        schema_node = schema_index.get(skey)
        if schema_node is None:
            schema_node = SchemaTreeSchema(schema_name=obj.schema_name, objects=[])
            schema_index[skey] = schema_node
            db_node.schemas.append(schema_node)
        schema_node.objects.append(
            SchemaTreeObject(
                id=obj.id,
                object_name=obj.object_name,
                object_type=obj.object_type,
                row_count=obj.row_count,
            )
        )

    return Envelope(
        data=SchemaObjectTree(connection_id=connection_id, databases=databases),
        message="",
    )
