# ─── VPC ────────────────────────────────────────────────────────────────────

resource "aws_vpc" "this" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true  # lets AWS assign human-readable hostnames to instances
  enable_dns_support   = true

  tags = { Name = "${var.project_name}-vpc" }
}

# ─── INTERNET GATEWAY ───────────────────────────────────────────────────────
# The front door — connects the VPC to the public internet

resource "aws_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id

  tags = { Name = "${var.project_name}-igw" }
}

# ─── PUBLIC SUBNETS ─────────────────────────────────────────────────────────
# One per AZ. The ALB and NAT Gateways live here.
# count = how many times to repeat this resource (one per AZ)

resource "aws_subnet" "public" {
  count             = length(var.public_subnet_cidrs)
  vpc_id            = aws_vpc.this.id
  cidr_block        = var.public_subnet_cidrs[count.index]
  availability_zone = var.availability_zones[count.index]

  # instances launched here automatically get a public IP
  map_public_ip_on_launch = true

  tags = { Name = "${var.project_name}-public-${count.index + 1}" }
}

# ─── PRIVATE SUBNETS (ECS) ──────────────────────────────────────────────────

resource "aws_subnet" "private" {
  count             = length(var.private_subnet_cidrs)
  vpc_id            = aws_vpc.this.id
  cidr_block        = var.private_subnet_cidrs[count.index]
  availability_zone = var.availability_zones[count.index]

  tags = { Name = "${var.project_name}-private-${count.index + 1}" }
}

# ─── DATABASE SUBNETS ───────────────────────────────────────────────────────

resource "aws_subnet" "db" {
  count             = length(var.db_subnet_cidrs)
  vpc_id            = aws_vpc.this.id
  cidr_block        = var.db_subnet_cidrs[count.index]
  availability_zone = var.availability_zones[count.index]

  tags = { Name = "${var.project_name}-db-${count.index + 1}" }
}

# ─── ELASTIC IPs FOR NAT GATEWAYS ───────────────────────────────────────────
# A NAT Gateway needs a static public IP address

resource "aws_eip" "nat" {
  count  = length(var.public_subnet_cidrs)
  domain = "vpc"

  tags = { Name = "${var.project_name}-eip-${count.index + 1}" }
}

# ─── NAT GATEWAYS ───────────────────────────────────────────────────────────
# One per public subnet (= one per AZ) — private subnets route outbound
# internet traffic through these. Lives in PUBLIC subnet (needs IGW access).

resource "aws_nat_gateway" "this" {
  count         = length(var.public_subnet_cidrs)
  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id

  # NAT Gateway must be created AFTER the IGW exists
  depends_on = [aws_internet_gateway.this]

  tags = { Name = "${var.project_name}-nat-${count.index + 1}" }
}

# ─── ROUTE TABLE: PUBLIC ────────────────────────────────────────────────────
# All outbound traffic (0.0.0.0/0) from public subnets goes to the IGW

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.this.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.this.id
  }

  tags = { Name = "${var.project_name}-rt-public" }
}

# Associate each public subnet with the public route table
resource "aws_route_table_association" "public" {
  count          = length(var.public_subnet_cidrs)
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# ─── ROUTE TABLES: PRIVATE (one per AZ) ────────────────────────────────────
# Each private subnet routes outbound traffic to its AZ's NAT Gateway

resource "aws_route_table" "private" {
  count  = length(var.private_subnet_cidrs)
  vpc_id = aws_vpc.this.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.this[count.index].id
  }

  tags = { Name = "${var.project_name}-rt-private-${count.index + 1}" }
}

resource "aws_route_table_association" "private" {
  count          = length(var.private_subnet_cidrs)
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private[count.index].id
}

# ─── ROUTE TABLES: DB ───────────────────────────────────────────────────────
# DB subnets have NO route to the internet — fully isolated

resource "aws_route_table" "db" {
  count  = length(var.db_subnet_cidrs)
  vpc_id = aws_vpc.this.id

  # No routes added — only local VPC traffic is allowed

  tags = { Name = "${var.project_name}-rt-db-${count.index + 1}" }
}

resource "aws_route_table_association" "db" {
  count          = length(var.db_subnet_cidrs)
  subnet_id      = aws_subnet.db[count.index].id
  route_table_id = aws_route_table.db[count.index].id
}

# ─── DB SUBNET GROUP ────────────────────────────────────────────────────────
# RDS requires a "subnet group" — a named collection of subnets it can use

resource "aws_db_subnet_group" "this" {
  name       = "${var.project_name}-db-subnet-group"
  subnet_ids = aws_subnet.db[*].id  # [*] = all db subnets

  tags = { Name = "${var.project_name}-db-subnet-group" }
}
