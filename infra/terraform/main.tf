# Call the VPC module — passes inputs in, gets outputs back
module "vpc" {
  source = "./modules/vpc"

  project_name         = var.project_name
  vpc_cidr             = var.vpc_cidr
  public_subnet_cidrs  = var.public_subnet_cidrs
  private_subnet_cidrs = var.private_subnet_cidrs
  db_subnet_cidrs      = var.db_subnet_cidrs
  availability_zones   = var.availability_zones
}

# Call the DATABASE module 
module "database" {
  source = "./modules/database"

  project_name = var.project_name
  db_subnet_group_name  = module.vpc.db_subnet_group_name
  rds_security_group_id = aws_security_group.rds.id
  db_name     = "final_project"
  db_username = var.db_username
  db_password = var.db_password

  multi_az                = false # set to true for production
  deletion_protection     = false # set to true for production
  skip_final_snapshot     = true  # set to false for production
  backup_retention_period = 0     # free tier limit; set to 7+ for production
}

# ─── SECURITY GROUP: ALB ────────────────────────────────────────────────────
# Accepts HTTP and HTTPS from anywhere on the internet

resource "aws_security_group" "alb" {
  name        = "${var.project_name}-alb-sg"
  description = "Allow HTTP/HTTPS inbound from internet"
  vpc_id      = module.vpc.vpc_id

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Allow all outbound — ALB needs to forward traffic to ECS
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"  # -1 means all protocols
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${var.project_name}-alb-sg" }
}

# ─── SECURITY GROUP: ECS ────────────────────────────────────────────────────
# Only accepts traffic from the ALB security group — not from the internet

resource "aws_security_group" "ecs" {
  name        = "${var.project_name}-ecs-sg"
  description = "Allow inbound only from ALB"
  vpc_id      = module.vpc.vpc_id

  ingress {
    description     = "Backend from ALB only"
    from_port       = 8000
    to_port         = 8000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  ingress {
    description     = "Frontend from ALB only"
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${var.project_name}-ecs-sg" }
}

# ─── SECURITY GROUP: RDS ────────────────────────────────────────────────────
# Only accepts PostgreSQL traffic from ECS — nothing else can reach the DB

resource "aws_security_group" "rds" {
  name        = "${var.project_name}-rds-sg"
  description = "Allow PostgreSQL inbound only from ECS"
  vpc_id      = module.vpc.vpc_id

  ingress {
    description     = "PostgreSQL from ECS only"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs.id]  # ← chaining again
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${var.project_name}-rds-sg" }
}

# ─── ALB MODULE ─────────────────────────────────────────────────────────────
# Creates the load balancer, target groups, HTTP listener, and /api/* routing rule.
# Must run before ECS so target group ARNs are available for service registration.

module "alb" {
  source = "./modules/alb"

  project_name          = var.project_name
  vpc_id                = module.vpc.vpc_id
  public_subnet_ids     = module.vpc.public_subnet_ids
  alb_security_group_id = aws_security_group.alb.id
}

module "ecs" {
  source = "./modules/ecs"

  project_name          = var.project_name
  private_subnet_ids    = module.vpc.private_subnet_ids
  ecs_security_group_id = aws_security_group.ecs.id

  backend_image  = var.backend_image
  frontend_image = var.frontend_image

  database_url = var.database_url
  secret_key   = var.secret_key
  algorithm    = var.algorithm

  backend_target_group_arn  = module.alb.backend_target_group_arn
  frontend_target_group_arn = module.alb.frontend_target_group_arn

  s3_bucket_name = aws_s3_bucket.documents.bucket
}

# ─── S3: DOCUMENT STORAGE ───────────────────────────────────────────────────
# Bucket for uploaded documents. Private — all reads go through the backend API.

resource "aws_s3_bucket" "documents" {
  bucket        = "${var.project_name}-documents"
  force_destroy = false

  tags = { Name = "${var.project_name}-documents" }
}

resource "aws_s3_bucket_versioning" "documents" {
  bucket = aws_s3_bucket.documents.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "documents" {
  bucket = aws_s3_bucket.documents.id
  rule {
    apply_server_side_encryption_by_default { sse_algorithm = "AES256" }
  }
}

resource "aws_s3_bucket_public_access_block" "documents" {
  bucket                  = aws_s3_bucket.documents.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ─── LAMBDA: IMAGE RESIZE ───────────────────────────────────────────────────

data "archive_file" "image_resize_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../../lambda/image_resize/build"
  output_path = "${path.module}/.terraform-build/image_resize.zip"
}

resource "aws_iam_role" "image_resize_lambda" {
  name = "${var.project_name}-image-resize-lambda"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "image_resize_basic" {
  role       = aws_iam_role.image_resize_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "image_resize_s3" {
  name = "${var.project_name}-image-resize-s3"
  role = aws_iam_role.image_resize_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject"
        ]
        Resource = [
          "${aws_s3_bucket.documents.arn}/original/*",
          "${aws_s3_bucket.documents.arn}/resized/*"
        ]
      }
    ]
  })
}

resource "aws_lambda_function" "image_resize" {
  function_name = "${var.project_name}-image-resize"
  role          = aws_iam_role.image_resize_lambda.arn
  handler       = "handler.lambda_handler"
  runtime       = "python3.12"
  timeout       = 30
  memory_size   = 512

  filename         = data.archive_file.image_resize_zip.output_path
  source_code_hash = data.archive_file.image_resize_zip.output_base64sha256

  environment {
    variables = {
      TARGET_WIDTH = "1024"
    }
  }
}

resource "aws_lambda_permission" "allow_s3_invoke_image_resize" {
  statement_id  = "AllowS3InvokeImageResize"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.image_resize.function_name
  principal     = "s3.amazonaws.com"
  source_arn    = aws_s3_bucket.documents.arn
}

resource "aws_s3_bucket_notification" "documents_resize" {
  bucket = aws_s3_bucket.documents.id

  lambda_function {
    lambda_function_arn = aws_lambda_function.image_resize.arn
    events              = ["s3:ObjectCreated:*"]
    filter_prefix       = "original/"
  }

  depends_on = [aws_lambda_permission.allow_s3_invoke_image_resize]
}