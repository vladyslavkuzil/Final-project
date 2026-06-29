# Project Dashboard (Modular Monolith)

Project Dashboard is a backend-first modular-monolith service to create, update, share, and manage project records and attached documents. The stack includes a FastAPI backend, a Next.js frontend, and a PostgreSQL database — all orchestrated with Docker Compose.

Quick start
-----------

1. Copy the example env file and update secrets locally (do not commit `.env`):

```bash
cp .env.example .env
# Edit .env to override defaults
```

2. Build and start the dev stack:

```bash
make dev
```

Migrations are applied automatically on startup via `entrypoint.sh`.

3. Verify the API is running:

```bash
curl http://localhost:8000/health
```

4. Frontend is available at `http://localhost:3000`.

What is included
-----------------

- `backend/src/` — FastAPI application (auth, projects, documents modules).
- `backend/Dockerfile` — builds the Python image for the backend.
- `backend/entrypoint.sh` — runs `alembic upgrade head` before the app starts.
- `frontend/` — Next.js application (Pages Router, TypeScript, Tailwind CSS).
- `frontend/Dockerfile` — builds the Node image for the frontend.
- `compose.yml` — defines `dev` and `test` profiles with separate databases.
- `Makefile` — convenience commands for common tasks.
- `.env.example` — documents all required environment variables.

Make commands
-------------

| Command                        | Description                                      |
| ------------------------------ | ------------------------------------------------ |
| `make dev`                     | Build and start the dev stack (API + DB + frontend) |
| `make down`                    | Stop and remove dev containers                   |
| `make test`                    | Run the test suite against a separate test DB    |
| `make down-test`               | Stop and remove test containers                  |
| `make migrate`                 | Manually apply pending migrations                |
| `make migration name="<msg>"`  | Generate a new Alembic migration                 |

Docker profiles
---------------

- `dev` — API (with hot reload), PostgreSQL on port `5432`, frontend on port `3000`.
- `test` — API runs pytest, separate PostgreSQL on port `5433`. Containers are removed after the run.

You must pass the same profile to `down` as you used to start:

```bash
docker compose --profile dev down
docker compose --profile test down
```

Environment variables
---------------------

All variables are documented in `.env.example`. Copy it to `.env` to get started. Key variables:

- `DATABASE_URL` / `TEST_DATABASE_URL` — connection strings for dev and test databases.
- `SECRET_KEY`, `ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES`, `REFRESH_TOKEN_EXPIRE_MINUTES` — JWT config.
- `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` — Postgres credentials.
- `NEXT_PUBLIC_API_URL` — backend URL exposed to the frontend browser.

Database Migrations
-------------------

Migrations are applied automatically on every container startup. For manual control:

### Generate a migration

After changing a SQLAlchemy model, generate a migration from inside the running dev container:

```bash
make migration name="describe your change"
```

The file is created in `backend/alembic/versions/`. Always review it before applying.

### Apply migrations manually

```bash
make migrate
```

### Roll back, check status, and other Alembic commands

Run these via `docker compose exec` while the dev stack is up:

```bash
# Roll back the last migration
docker compose --profile dev exec api uv run alembic downgrade -1

# Roll back to a specific revision
docker compose --profile dev exec api uv run alembic downgrade <revision_id>

# Show current revision
docker compose --profile dev exec api uv run alembic current

# Show migration history
docker compose --profile dev exec api uv run alembic history --verbose

# Mark DB as up-to-date without running migrations
docker compose --profile dev exec api uv run alembic stamp head
```

### Alembic cheat sheet

| Command                            | Description                                      |
| ---------------------------------- | ------------------------------------------------ |
| `revision --autogenerate -m "msg"` | Generate a new migration                         |
| `upgrade head`                     | Apply all pending migrations                     |
| `upgrade <revision_id>`            | Upgrade to a specific revision                   |
| `downgrade -1`                     | Roll back the last migration                     |
| `downgrade <revision_id>`          | Roll back to a specific revision                 |
| `current`                          | Show current database revision                   |
| `history --verbose`                | Show detailed migration history                  |
| `stamp head`                       | Mark DB as up-to-date without running migrations |

### Best practices

- Always commit migration files (`backend/alembic/versions/*.py`) to Git.
- Never modify a migration that has already been applied in a shared environment.
- Review autogenerated migrations before applying — Alembic doesn't always get it right.
- Ensure all models are imported in `backend/alembic/env.py` so Alembic can detect changes.

### Troubleshooting

**Alembic detects no changes** — make sure the model is imported in `backend/alembic/env.py` and inherits from the shared `Base`.

**Migration generated incorrectly** — delete the file and regenerate:

```bash
rm backend/alembic/versions/<migration_file>.py
make migration name="correct description"
```

**DB and migration history out of sync** — inspect with `current` and `history`, then use `stamp head` to realign if needed.

License
-------

MIT (default) — replace or add a license file as appropriate.
