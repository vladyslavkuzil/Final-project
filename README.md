# Project Dashboard (Modular Monolith)

Project Dashboard is a backend-first modular-monolith service to create, update, share, and manage project records and attached documents. This repository currently contains a minimal FastAPI application (health endpoint) and a Docker-based local development stack with PostgreSQL.

Status: scaffolded — backend entrypoint, Dockerfile, and Docker Compose are present. Business logic, auth, and storage handlers will be added in subsequent iterations.

Quick start
-----------

1. Copy the example env file and update secrets locally (do not commit `.env`):

```bash
cp .env.example .env
# Edit .env to override defaults
```

2. Build and start the stack with Docker Compose:

```bash
docker compose -f compose.yml up --build
```

3. Verify the API is running:

```bash
curl http://localhost:8000/health
```

What is included
-----------------

- `backend/src/main.py` — minimal FastAPI app with a `/health` endpoint.
- `Dockerfile` — builds a simple Python image for the backend.
- `compose.yml` — starts the `api` and `db` services and persists Postgres data in a named volume.
- `.env.example` — documents application and database environment variables to configure.

Environment variables
---------------------

The project expects the following environment variables (see `.env.example`):

- `APP_NAME`, `APP_ENV`, `APP_DEBUG`, `APP_HOST`, `APP_PORT`
- `SECRET_KEY`, `ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES`
- `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_HOST`, `POSTGRES_PORT`, `DATABASE_URL`

Running tests
-------------

Requires the `db` service to be running. Run the suite inside the `api` container:

```bash
docker compose -f compose.yml up --build
docker compose exec api uv run pytest tests/ -v
```

Notes & next steps
-------------------

- Keep your real secrets out of source control — use `.env` locally and secret stores in CI/CD.
- Next tasks: add configuration loader (Pydantic `BaseSettings`), database models, Alembic migrations, and JWT auth.

License
-------

MIT (default) — replace or add a license file as appropriate.

