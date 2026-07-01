# ─── RDS POSTGRESQL ─────────────────────────────────────────────────────────

resource "aws_db_instance" "this" {
  identifier = "${var.project_name}-postgres"

  # Engine
  engine         = "postgres"
  engine_version = var.engine_version
  instance_class = var.instance_class

  # Storage
  allocated_storage     = var.allocated_storage
  max_allocated_storage = var.max_allocated_storage > 0 ? var.max_allocated_storage : null
  storage_type           = var.storage_type
  storage_encrypted      = var.storage_encrypted

  # Database and credentials
  db_name  = var.db_name
  username = var.db_username
  password = var.db_password
  port     = var.db_port

  # Networking — lives in the db subnets created by the vpc module,
  # only reachable from ECS (security group passed in from the root module)
  db_subnet_group_name   = var.db_subnet_group_name
  vpc_security_group_ids = [var.rds_security_group_id]
  publicly_accessible    = false

  # High availability — standby replica in a second AZ for automatic failover
  multi_az = var.multi_az

  # Backups
  backup_retention_period = var.backup_retention_period
  backup_window            = var.backup_window
  maintenance_window       = var.maintenance_window
  copy_tags_to_snapshot    = true

  # Deletion safety
  deletion_protection       = var.deletion_protection
  skip_final_snapshot       = var.skip_final_snapshot
  final_snapshot_identifier = var.skip_final_snapshot ? null : "${var.project_name}-postgres-final"

  tags = { Name = "${var.project_name}-postgres" }
}
