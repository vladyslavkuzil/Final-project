.PHONY: dev down down-test test migrate migration

dev:
	docker compose --profile dev up --build

dev-detached:
	docker compose --profile dev up --build -d
	
down:
	docker compose --profile dev down

down-test:
	docker compose --profile test down

test:
	docker compose --profile test run --rm api-test

migrate:
	docker compose --profile dev exec api uv run alembic upgrade head

migration:
	@test -n "$(name)" || (echo "Usage: make migration name=\"describe your change\""; exit 1)
	docker compose --profile dev exec api uv run alembic revision --autogenerate -m "$(name)"
