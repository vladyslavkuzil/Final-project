#!/bin/sh
set -e
uv run alembic upgrade head
exec "$@"
