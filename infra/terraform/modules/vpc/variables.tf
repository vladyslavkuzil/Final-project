variable "vpc_cidr" {
  description = "CIDR block for the VPC (e.g. 10.0.0.0/16)"
  type        = string
}

variable "public_subnet_cidrs" {
  description = "List of CIDR blocks for public subnets (one per AZ)"
  type        = list(string)
}

variable "private_subnet_cidrs" {
  description = "List of CIDR blocks for private (ECS) subnets (one per AZ)"
  type        = list(string)
}

variable "db_subnet_cidrs" {
  description = "List of CIDR blocks for database subnets (one per AZ)"
  type        = list(string)
}

variable "availability_zones" {
  description = "List of AZs to spread subnets across (e.g. [eu-north-1a, eu-north-1b])"
  type        = list(string)
}

variable "project_name" {
  description = "Used to name/tag all resources"
  type        = string
}
