.PHONY: dev down test migrate migration

dev:
	docker compose --profile dev up --build

down:
	docker compose --profile dev down

down-test:
	docker compose --profile test down

test:
	docker compose --profile test run --rm api-test

migrate:
	docker compose --profile dev exec api uv run alembic upgrade head

migration:
	docker compose --profile dev exec api uv run alembic revision --autogenerate -m "$(name)"
