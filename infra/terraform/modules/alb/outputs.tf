output "alb_dns_name" {
  description = "Public DNS name of the Application Load Balancer"
  value       = aws_lb.this.dns_name
}

output "alb_arn" {
  description = "ARN of the Application Load Balancer"
  value       = aws_lb.this.arn
}

output "backend_target_group_arn" {
  description = "ARN of the backend target group — pass to ECS service load_balancer block"
  value       = aws_lb_target_group.backend.arn
}

output "frontend_target_group_arn" {
  description = "ARN of the frontend target group — pass to ECS service load_balancer block"
  value       = aws_lb_target_group.frontend.arn
}
