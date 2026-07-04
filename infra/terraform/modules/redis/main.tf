# ─── ELASTICACHE REDIS ──────────────────────────────────────────────────────

resource "aws_elasticache_subnet_group" "this" {
  name       = "${var.project_name}-redis-subnet-group"
  subnet_ids = var.subnet_ids

  tags = { Name = "${var.project_name}-redis-subnet-group" }
}

resource "aws_elasticache_cluster" "this" {
  cluster_id           = "${var.project_name}-redis"
  engine               = "redis"
  engine_version       = var.engine_version
  node_type            = var.node_type
  num_cache_nodes      = 1
  port                 = var.port
  parameter_group_name = "default.redis7"

  subnet_group_name  = aws_elasticache_subnet_group.this.name
  security_group_ids = [var.security_group_id]

  tags = { Name = "${var.project_name}-redis" }
}
