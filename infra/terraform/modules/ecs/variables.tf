variable "project_name" {
  type = string
}

variable "private_subnet_ids" {
  type = list(string)
}

variable "ecs_security_group_id" {
  type = string
}

variable "alb_dns_name" {
  type        = string
  description = "DNS name of the Application Load Balancer"
}

variable "backend_image" {
  type = string
}

variable "frontend_image" {
  type = string
}

variable "backend_port" {
  type    = number
  default = 8000
}

variable "frontend_port" {
  type    = number
  default = 3000
}

variable "backend_desired_count" {
  type    = number
  default = 1
}

variable "frontend_desired_count" {
  type    = number
  default = 1
}

variable "backend_cpu" {
  type    = number
  default = 512
}

variable "backend_memory" {
  type    = number
  default = 1024
}

variable "frontend_cpu" {
  type    = number
  default = 256
}

variable "frontend_memory" {
  type    = number
  default = 512
}

variable "log_retention_days" {
  type    = number
  default = 14
}

variable "database_url" {
  type      = string
  sensitive = true
}

variable "secret_key" {
  type      = string
  sensitive = true
}

variable "algorithm" {
  type    = string
  default = "HS256"
}

variable "backend_target_group_arn" {
  description = "ARN of the ALB target group for the backend service"
  type        = string
}

variable "frontend_target_group_arn" {
  description = "ARN of the ALB target group for the frontend service"
  type        = string
}

variable "s3_bucket_name" {
  description = "S3 bucket name injected into the backend container"
  type        = string
}