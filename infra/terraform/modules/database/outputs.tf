output "db_endpoint" {
  description = "Full RDS endpoint (host:port) for use in a connection string"
  value       = aws_db_instance.this.endpoint
}

output "db_address" {
  description = "RDS host, without the port"
  value       = aws_db_instance.this.address
}

output "db_port" {
  description = "Port Postgres listens on"
  value       = aws_db_instance.this.port
}

output "db_name" {
  description = "Name of the database"
  value       = aws_db_instance.this.db_name
}

output "db_instance_id" {
  description = "RDS instance identifier"
  value       = aws_db_instance.this.id
}

output "db_instance_arn" {
  description = "ARN of the RDS instance"
  value       = aws_db_instance.this.arn
}
