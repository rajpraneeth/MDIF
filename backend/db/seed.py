"""Idempotent dev seed script (GLD-13).

Gives a fresh setup known logins + minimal data so the UI has something to show.
Run **after** ``alembic upgrade head``:

    python -m db.seed              # from backend/
    docker exec infra-backend-1 python -m db.seed   # inside the compose backend

Seeds (all skipped if they already exist — re-running is a no-op):
- a ``dev`` environment,
- three demo users, one per role, all with password ``Passw0rd!``:
  ``admin@example.com`` (admin), ``de@example.com`` (data_engineer),
  ``req@example.com`` (requester),
- one sample SQL Server connection in ``dev`` (secret stored as a ``secret_ref``,
  never a raw value — §10).

This is dev-only convenience; it never seeds prod data and never touches the
auth/users APIs.
"""
from __future__ import annotations

import asyncio
import logging

from sqlalchemy import select

from db.base import AsyncSessionLocal
from db.enums import ConnectionType, UserRole
from db.models.connection import Connection
from db.models.environment import Environment
from db.models.user import User
from core.security import hash_password

logger = logging.getLogger("mdif.seed")

DEFAULT_PASSWORD = "Passw0rd!"

DEMO_USERS = [
    ("admin@example.com", "Demo Admin", UserRole.admin),
    ("de@example.com", "Demo Data Engineer", UserRole.data_engineer),
    ("req@example.com", "Demo Requester", UserRole.requester),
]


async def _get_or_create_dev_env(session) -> Environment:
    existing = (
        await session.execute(select(Environment).where(Environment.name == "dev"))
    ).scalar_one_or_none()
    if existing is not None:
        logger.info("env 'dev' already exists — skipping")
        return existing
    env = Environment(
        name="dev",
        description="Local development environment (seeded)",
        is_active=True,
    )
    session.add(env)
    await session.flush()
    logger.info("created env 'dev' (%s)", env.id)
    return env


async def _seed_users(session, env: Environment) -> None:
    hashed = hash_password(DEFAULT_PASSWORD)
    for email, full_name, role in DEMO_USERS:
        existing = (
            await session.execute(select(User).where(User.email == email))
        ).scalar_one_or_none()
        if existing is not None:
            logger.info("user %s already exists — skipping", email)
            continue
        session.add(
            User(
                email=email,
                full_name=full_name,
                hashed_password=hashed,
                role=role,
                is_active=True,
                env_id=env.id,
            )
        )
        logger.info("created user %s (%s)", email, role.value)


async def _seed_connection(session, env: Environment) -> None:
    existing = (
        await session.execute(
            select(Connection)
            .where(Connection.name == "Sample SQL Server")
            .where(Connection.env_id == env.id)
            .where(Connection.deleted_at.is_(None))
        )
    ).scalar_one_or_none()
    if existing is not None:
        logger.info("connection 'Sample SQL Server' already exists — skipping")
        return
    session.add(
        Connection(
            name="Sample SQL Server",
            type=ConnectionType.sql_server,
            # Secrets are referenced, never stored raw (§10).
            config={
                "host": "localhost",
                "port": 1433,
                "database": "demo",
                "secret_ref": "CONN_SAMPLE_SQL_PWD",
            },
            env_id=env.id,
        )
    )
    logger.info("created connection 'Sample SQL Server'")


async def seed() -> None:
    async with AsyncSessionLocal() as session:
        env = await _get_or_create_dev_env(session)
        await _seed_users(session, env)
        await _seed_connection(session, env)
        await session.commit()
    logger.info("seed complete")


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    asyncio.run(seed())


if __name__ == "__main__":
    main()
