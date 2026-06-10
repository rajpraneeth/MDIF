# MDIF — Metadata-Driven Ingestion Framework

Full-stack internal tool for Data Engineering teams to manage metadata-driven
ingestion pipelines. See `PROJECT_SPEC.md` for the authoritative spec.

## Monorepo layout

```
backend/    FastAPI + SQLAlchemy 2 (async) + Postgres 15 + Alembic
frontend/   Vite + React 18 + TypeScript + Tailwind + shadcn/ui + React Query + Zustand
infra/      docker-compose for local dev (postgres + backend + frontend)
```

## Quick start

```bash
cp .env.example .env          # adjust secrets as needed
docker compose -f infra/docker-compose.yml up --build
```

- Backend:  http://localhost:8000  (health: `/health`)
- Frontend: http://localhost:5173
- Postgres: localhost:5432

## Local development (without Docker)

Backend:

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

## Database migrations & seed data

The schema is managed by Alembic; a fresh database has **no rows**. Run the
migration first, then the seed script to get known demo logins + sample data.

```bash
# 1. Apply the schema
cd backend && alembic upgrade head
# 2. Seed demo users + a dev env + a sample connection (idempotent — safe to re-run)
python -m db.seed
```

Inside the Docker compose stack, run both against the backend container:

```bash
docker exec infra-backend-1 alembic upgrade head
docker exec infra-backend-1 python -m db.seed
```

### Demo logins (dev only)

All three share the password **`Passw0rd!`**:

| Email               | Role            |
|---------------------|-----------------|
| `admin@example.com` | admin           |
| `de@example.com`    | data_engineer   |
| `req@example.com`   | requester       |

The seed also creates a `dev` environment and one sample SQL Server connection
(secret stored as a `secret_ref`, never a raw value). Re-running `python -m db.seed`
skips anything that already exists, so it is a no-op on an already-seeded DB. It
is dev-only convenience and never seeds production data.

## Status

Phase 0 (scaffold) — app structure, config, DB connection wiring only. Business
logic (models, auth, APIs, UI) lands in subsequent phases per spec §12.
