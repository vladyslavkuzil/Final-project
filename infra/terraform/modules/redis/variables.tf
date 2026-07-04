variable "project_name" {
  description = "Used to name/tag all resources"
  type        = string
}

variable "subnet_ids" {
  description = "List of subnet IDs for the ElastiCache subnet group (private subnets)"
  type        = list(string)
}

variable "security_group_id" {
  description = "Security group ID that allows Redis traffic only from ECS"
  type        = string
}

variable "node_type" {
  description = "ElastiCache node type (e.g. cache.t3.micro)"
  type        = string
  default     = "cache.t3.micro"
}

variable "engine_version" {
  description = "Redis engine version"
  type        = string
  default     = "7.1"
}

variable "port" {
  description = "Port Redis listens on"
  type        = number
  default     = 6379
}
