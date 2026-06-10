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

## Status

Phase 0 (scaffold) — app structure, config, DB connection wiring only. Business
logic (models, auth, APIs, UI) lands in subsequent phases per spec §12.
