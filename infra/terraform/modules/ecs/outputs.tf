output "cluster_name" {
	description = "Name of the ECS cluster"
	value       = aws_ecs_cluster.this.name
}

output "cluster_arn" {
	description = "ARN of the ECS cluster"
	value       = aws_ecs_cluster.this.arn
}

output "backend_task_definition_arn" {
	description = "ARN of the backend ECS task definition"
	value       = aws_ecs_task_definition.backend.arn
}

output "frontend_task_definition_arn" {
	description = "ARN of the frontend ECS task definition"
	value       = aws_ecs_task_definition.frontend.arn
}

output "backend_log_group_name" {
	description = "CloudWatch log group for backend service"
	value       = aws_cloudwatch_log_group.backend.name
}

output "frontend_log_group_name" {
	description = "CloudWatch log group for frontend service"
	value       = aws_cloudwatch_log_group.frontend.name
}
