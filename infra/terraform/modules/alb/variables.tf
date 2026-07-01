variable "project_name" {
  description = "Used to name/tag all resources"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID where target groups will be created"
  type        = string
}

variable "public_subnet_ids" {
  description = "Public subnet IDs where the ALB will be placed"
  type        = list(string)
}

variable "alb_security_group_id" {
  description = "Security group ID for the ALB (allows HTTP/HTTPS from internet)"
  type        = string
}

variable "backend_port" {
  description = "Port the backend container listens on"
  type        = number
  default     = 8000
}

variable "frontend_port" {
  description = "Port the frontend container listens on"
  type        = number
  default     = 3000
}
