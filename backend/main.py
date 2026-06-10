"""MDIF backend application entrypoint.

App wiring, CORS, DB connectivity healthcheck, and the ``/api/v1`` domain routers.
All responses — success and error — use the ``{ success, data, message }``
envelope (PRD decision 4).
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from starlette.exceptions import HTTPException as StarletteHTTPException

from api.routers import (
    auth,
    connections,
    environments,
    requests,
    schema_objects,
    users,
)
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


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(_request: Request, exc: StarletteHTTPException):
    """Wrap HTTP errors in the standard envelope (PRD decision 4)."""
    return JSONResponse(
        status_code=exc.status_code,
        content={"success": False, "data": None, "message": str(exc.detail)},
        headers=getattr(exc, "headers", None),
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_request: Request, exc: RequestValidationError):
    """Wrap 422 validation errors in the standard envelope."""
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "success": False,
            "data": {"errors": jsonable_encoder(exc.errors())},
            "message": "Validation error",
        },
    )


api_v1 = "/api/v1"
app.include_router(auth.router, prefix=api_v1)
app.include_router(users.router, prefix=api_v1)
app.include_router(environments.router, prefix=api_v1)
app.include_router(connections.router, prefix=api_v1)
app.include_router(schema_objects.router, prefix=api_v1)
app.include_router(requests.router, prefix=api_v1)


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
