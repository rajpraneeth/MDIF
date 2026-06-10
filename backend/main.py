"""MDIF backend application entrypoint.

Scaffold only (PROJECT_SPEC §11 Prompt 0): app wiring, CORS, DB connectivity
healthcheck. Domain routers are mounted under ``/api/v1`` in later phases.
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from core.config import settings
from db.base import engine


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Verify the DB connection is reachable on startup.
    async with engine.connect() as conn:
        await conn.execute(text("SELECT 1"))
    yield
    await engine.dispose()


app = FastAPI(
    title="MDIF API",
    version="0.1.0",
    description="Metadata-Driven Ingestion Framework",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict[str, str]:
    """Liveness check that also confirms DB connectivity."""
    async with engine.connect() as conn:
        await conn.execute(text("SELECT 1"))
    return {
        "status": "ok",
        "environment": settings.ENVIRONMENT_NAME,
    }


@app.get("/api/v1/health")
async def api_health() -> dict[str, str]:
    return await health()
