variable "region" {
  description = "AWS region"
  type        = string
  default     = "eu-north-1"
}

variable "profile" {
  description = "AWS CLI profile name"
  type        = string
}

variable "project_name" {
  description = "Used to prefix/tag all resources"
  type        = string
  default     = "final-project"
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets (one per AZ)"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private (ECS) subnets (one per AZ)"
  type        = list(string)
  default     = ["10.0.3.0/24", "10.0.4.0/24"]
}

variable "db_subnet_cidrs" {
  description = "CIDR blocks for database subnets (one per AZ)"
  type        = list(string)
  default     = ["10.0.5.0/24", "10.0.6.0/24"]
}

variable "availability_zones" {
  description = "AZs to spread subnets across"
  type        = list(string)
  default     = ["eu-north-1a", "eu-north-1b"]
}

variable "db_username" {
  description = "Master username for the database"
  type      = string
  sensitive = true
}

variable "db_password" {
  description = "Master password for the database"
  type      = string
  sensitive = true
}