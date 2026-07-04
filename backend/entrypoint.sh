#!/bin/sh
set -e

echo "=== ENTRYPOINT STARTED ==="

uv run alembic upgrade head

echo "=== MIGRATIONS FINISHED ==="

exec "$@"