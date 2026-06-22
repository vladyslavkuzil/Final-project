variable "region" {
    description = "AWS region"
    type        = string
    default     = "eu-north-1"
}

variable "instance_type" {
    description = "EC2 instance type"
    type        = string
    default     = "t2.micro"
}

variable "profile" {
    description = "IAM profile"
    type        = string
}

variable "ami_id" {
  description = "AMI ID for the EC2 instance"
  type        = string
}

