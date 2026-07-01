variable "project_name" {
  description = "Used to name/tag all resources"
  type        = string
}

# ─── NETWORKING (passed in from the vpc module) ────────────────────────────

variable "db_subnet_group_name" {
  description = "Name of the RDS DB subnet group (output of the vpc module)"
  type        = string
}

variable "rds_security_group_id" {
  description = "Security group ID that allows Postgres traffic only from ECS (output of the root module)"
  type        = string
}

# ─── ENGINE ─────────────────────────────────────────────────────────────────

variable "engine_version" {
  description = "PostgreSQL major version — AWS selects the latest available minor version in the region"
  type        = string
  default     = "16"
}

variable "instance_class" {
  description = "RDS instance class (e.g. db.t3.micro)"
  type        = string
  default     = "db.t3.micro"
}

variable "allocated_storage" {
  description = "Allocated storage size in GB"
  type        = number
  default     = 20
}

variable "max_allocated_storage" {
  description = "Upper limit in GB for storage autoscaling (set to 0 to disable autoscaling)"
  type        = number
  default     = 100
}

variable "storage_type" {
  description = "EBS storage type (gp3 recommended)"
  type        = string
  default     = "gp3"
}

variable "db_port" {
  description = "Port Postgres listens on"
  type        = number
  default     = 5432
}

variable "db_name" {
  description = "Name of the database created when the instance is provisioned"
  type        = string
  default     = "final_project"
}

# ─── CREDENTIALS (sensitive) ────────────────────────────────────────────────
# No defaults on purpose — apply fails fast if these aren't supplied.
# Pass them in via TF_VAR_db_username / TF_VAR_db_password (env vars) or a
# .tfvars file that is NOT committed to the repo. Never hardcode these.

variable "db_username" {
  description = "Master username for the database"
  type        = string
  sensitive   = true

  validation {
    condition     = can(regex("^[a-zA-Z][a-zA-Z0-9_]*$", var.db_username))
    error_message = "db_username must start with a letter and contain only letters, digits and underscores (PostgreSQL requirement)."
  }
}

variable "db_password" {
  description = "Master password for the database"
  type        = string
  sensitive   = true

  validation {
    condition     = length(var.db_password) >= 8 && length(var.db_password) <= 128
    error_message = "db_password must be between 8 and 128 characters (RDS requirement)."
  }
}

# ─── BACKUPS, ENCRYPTION, HIGH AVAILABILITY ────────────────────────────────

variable "multi_az" {
  description = "Run a standby replica in a second AZ for automatic failover. Set to true for production."
  type        = bool
  default     = false
}

variable "backup_retention_period" {
  description = "Number of days to keep automated backups"
  type        = number
  default     = 7
}

variable "backup_window" {
  description = "Daily time range (UTC) for automated backups, format hh24:mi-hh24:mi"
  type        = string
  default     = "03:00-04:00"
}

variable "maintenance_window" {
  description = "Weekly time range (UTC) for maintenance, format ddd:hh24:mi-ddd:hh24:mi"
  type        = string
  default     = "mon:04:30-mon:05:30"
}

variable "storage_encrypted" {
  description = "Encrypt the underlying storage at rest"
  type        = bool
  default     = true
}

variable "deletion_protection" {
  description = "Protect the instance from accidental deletion. Set to true for production."
  type        = bool
  default     = false
}

variable "skip_final_snapshot" {
  description = "Skip creating a final snapshot on destroy. Set to false for production."
  type        = bool
  default     = true
}
