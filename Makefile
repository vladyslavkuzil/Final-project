.PHONY: dev down down-test test migrate migration tf-plan tf-apply tf-destroy

TF=cd infra/terraform && ./terraform

# ── Terraform ────────────────────────────────────────────────────────────────

tf-plan:
	$(TF) plan

tf-apply:
	@echo "⚠️  WARNING: This will create real AWS resources that cost money."
	@echo "NAT Gateways cost ~\$$0.045/hr each. Run 'make tf-destroy' when done."
	@read -p "Type 'yes' to continue: " confirm && [ "$$confirm" = "yes" ] || (echo "Aborted."; exit 1)
	$(TF) apply

tf-destroy:
	@echo "⚠️  This will DESTROY all AWS resources managed by Terraform."
	@read -p "Type 'yes' to continue: " confirm && [ "$$confirm" = "yes" ] || (echo "Aborted."; exit 1)
	$(TF) destroy

# ─────────────────────────────────────────────────────────────────────────────

dev:
	docker compose --profile dev up --build

dev-fresh:
	docker compose --profile dev down -v
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
