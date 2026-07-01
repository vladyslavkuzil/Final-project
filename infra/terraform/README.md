# Terraform Deployment Workflow

This document covers how to deploy, update, and tear down the AWS infrastructure for the Project Management Dashboard.

All commands run from `infra/terraform/`.

---

## Prerequisites

| Requirement | Details |
|---|---|
| Terraform | >= 1.9.0 — check with `terraform version` |
| AWS CLI | Configured with a profile that has sufficient IAM permissions |

---

## First-Time Setup

### 1. Create your tfvars file

Create `infra/terraform/terraform.tfvars` — this file is gitignored and must never be committed:

```hcl
profile        = "your-aws-cli-profile"
db_username    = "project_user"
db_password    = "a-strong-password-min-8-chars"
backend_image  = "nginx:latest"
frontend_image = "nginx:latest"
database_url   = "postgresql+psycopg://project_user:a-strong-password@PLACEHOLDER:5432/final_project"
secret_key     = "your-jwt-secret-key"
```

> **`backend_image` / `frontend_image`:** Any valid image URI works here. For infrastructure testing you can use `nginx:latest` — it's public, ECS can pull it without any ECR setup, and it proves all 43 resources provision correctly. Replace with real ECR image URIs when you're ready to run the actual application.

> **`database_url`:** The RDS hostname is not known until after the first `terraform apply`. Use `PLACEHOLDER` on the first apply, then run `terraform output db_endpoint` to get the real value, update your tfvars, and run `terraform apply` again to inject the correct URL into the ECS task definition.

### 2. Initialize Terraform

Downloads the AWS provider plugin and prepares the working directory. Run this once, and again any time you add or change a module source:

```bash
terraform init
```

---

## Standard Workflow

### Plan

Shows every resource Terraform will create, modify, or destroy without making any changes. Always review this before applying:

```bash
terraform plan
```

What to look for:
- New resources are shown with `+`
- Modified resources with `~`
- Destroyed resources with `-`
- Sensitive values are redacted automatically

### Apply

Creates or updates infrastructure. Terraform prints the plan one more time and asks for confirmation before proceeding:

```bash
terraform apply
```

Takes **10–15 minutes** on first run — RDS provisioning is the slowest step.

To skip the confirmation prompt (useful in CI):

```bash
terraform apply -auto-approve
```

### Read outputs

After a successful apply, retrieve the deployed endpoints:

```bash
terraform output
```

The most important values:

| Output | Description |
|---|---|
| `alb_dns_name` | Public URL of the app |
| `db_endpoint` | RDS host:port — needed to build `database_url` after first deploy |
| `backend_log_group_name` | CloudWatch log group for FastAPI |
| `frontend_log_group_name` | CloudWatch log group for Next.js |

To read a single sensitive output:

```bash
terraform output -raw db_endpoint
```

---

## Verifying the Infrastructure

After `terraform apply` completes, confirm the ALB is reachable regardless of which image you used:

```bash
ALB=$(terraform output -raw alb_dns_name)

# Should return HTTP 200 or 404 — any response proves the ALB and routing rules work
curl -I http://$ALB/
curl -I http://$ALB/api/health
```

If using `nginx:latest` as a placeholder, expect `200` on `/` and `404` on `/api/health` — that is correct behaviour. The routing rule is working; nginx just doesn't know the `/health` path. ECS tasks will show as unhealthy and cycle, which is expected with a placeholder image.

---

## Updating the Application

To deploy a new container image:

1. Build and push the new image to a registry (ECR or otherwise).
2. Update `backend_image` or `frontend_image` in your tfvars.
3. Run `terraform apply` — Terraform updates the ECS task definition and triggers a rolling deploy of the service.

---

## Viewing Logs

```bash
# Tail backend logs
aws logs tail /ecs/final-project/backend --follow --profile your-profile

# Tail frontend logs
aws logs tail /ecs/final-project/frontend --follow --profile your-profile
```

Or navigate to CloudWatch → Log groups in the AWS console and search for `/ecs/final-project/`.

---

## Destroy (Dev Only)

Tears down all infrastructure. Because `deletion_protection = false` and `skip_final_snapshot = true` are set for dev, RDS will be deleted immediately with no snapshot.

```bash
terraform destroy
```

> **Do not run `terraform destroy` against production.** The production database has `deletion_protection = true` which will cause destroy to fail intentionally — you must disable it manually in the AWS console first.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| ECS tasks keep restarting | Wrong `database_url` in tfvars | Check logs, fix the URL, re-apply |
| ECS tasks unhealthy with `nginx:latest` | Expected — placeholder image doesn't serve `/health` | Normal during infra testing |
| ALB returns 502 | ECS tasks not healthy yet | Wait 2 minutes; check CloudWatch logs |
| `terraform init` fails | Provider cache stale | Delete `.terraform/` and re-init |
| `Error: db_username` validation fails | Username starts with a number or has special chars | PostgreSQL requires usernames to start with a letter |
