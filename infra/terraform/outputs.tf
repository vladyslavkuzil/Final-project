output "vpc_id" {
  description = "ID of the VPC"
  value       = module.vpc.vpc_id
}

output "public_subnet_ids" {
  description = "IDs of the public subnets"
  value       = module.vpc.public_subnet_ids
}

output "private_subnet_ids" {
  description = "IDs of the private (ECS) subnets"
  value       = module.vpc.private_subnet_ids
}

output "db_subnet_ids" {
  description = "IDs of the database subnets"
  value       = module.vpc.db_subnet_ids
}

output "alb_sg_id" {
  description = "Security group ID for the ALB"
  value       = aws_security_group.alb.id
}

output "ecs_sg_id" {
  description = "Security group ID for ECS"
  value       = aws_security_group.ecs.id
}

output "rds_sg_id" {
  description = "Security group ID for RDS"
  value       = aws_security_group.rds.id
}

output "db_subnet_group_name" {
  description = "Name of the RDS DB subnet group"
  value       = module.vpc.db_subnet_group_name
}

output "db_endpoint" {
  description = "Full RDS endpoint (host:port) for use in a connection string"
  value = module.database.db_endpoint
}

output "db_port" {
  description = "Port Postgres listens on"
  value = module.database.db_port
}

output "db_name" {
    description = "Name of the database"
  value = module.database.db_name
}

output "ecs_cluster_name" {
  description = "Name of the ECS cluster"
  value       = module.ecs.cluster_name
}

output "ecs_cluster_arn" {
  description = "ARN of the ECS cluster"
  value       = module.ecs.cluster_arn
}

output "backend_task_definition_arn" {
  description = "ARN of the backend ECS task definition"
  value       = module.ecs.backend_task_definition_arn
}

output "frontend_task_definition_arn" {
  description = "ARN of the frontend ECS task definition"
  value       = module.ecs.frontend_task_definition_arn
}

output "backend_log_group_name" {
  description = "CloudWatch log group for backend service"
  value       = module.ecs.backend_log_group_name
}

output "frontend_log_group_name" {
  description = "CloudWatch log group for frontend service"
  value       = module.ecs.frontend_log_group_name
}

output "alb_dns_name" {
  description = "Public DNS name of the Application Load Balancer — use this to reach the app"
  value       = module.alb.alb_dns_name
}

output "documents_bucket_name" {
  value = aws_s3_bucket.documents.bucket
}