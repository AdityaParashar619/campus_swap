terraform {
  required_version = "~> 1.14"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

provider "aws" {
  region              = "us-east-1"
  allowed_account_ids = [var.aws_account_id]

  default_tags {
    tags = { Project = "CampusSwap", Environment = "synthetic-demo", ManagedBy = "Terraform" }
  }
}

variable "aws_account_id" {
  description = "AWS account number independently reviewed for this demo."
  type        = string
  validation {
    condition     = can(regex("^[0-9]{12}$", var.aws_account_id))
    error_message = "Supply a 12-digit AWS account ID."
  }
}

variable "public_subnet_id" {
  description = "Existing us-east-1 subnet with an Internet Gateway route and DNS support."
  type        = string
  validation {
    condition     = can(regex("^subnet-[0-9a-f]+$", var.public_subnet_id))
    error_message = "Supply the reviewed subnet ID."
  }
}

variable "ubuntu_ami_id" {
  description = "Reviewed Canonical Ubuntu Server 24.04 LTS amd64 AMI ID for us-east-1."
  type        = string
  validation {
    condition     = can(regex("^ami-[0-9a-f]+$", var.ubuntu_ami_id))
    error_message = "Supply the reviewed AMI ID."
  }
}

data "aws_subnet" "demo" {
  id = var.public_subnet_id
}

data "aws_ami" "ubuntu" {
  owners = ["099720109477"]

  filter {
    name   = "image-id"
    values = [var.ubuntu_ami_id]
  }

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*"]
  }

  filter {
    name   = "state"
    values = ["available"]
  }
}

resource "aws_security_group" "demo" {
  name_prefix = "campusswap-demo-"
  description = "CampusSwap HTTPS and ACME only"
  vpc_id      = data.aws_subnet.demo.vpc_id

  ingress {
    description = "ACME HTTP-01 only"
    protocol    = "tcp"
    from_port   = 80
    to_port     = 80
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "Public demo HTTPS"
    protocol    = "tcp"
    from_port   = 443
    to_port     = 443
    cidr_blocks = ["0.0.0.0/0"]
  }

  dynamic "egress" {
    for_each = { 80 = "Ubuntu mirrors", 443 = "SSM and HTTPS downloads", 465 = "Gmail submission over TLS", 27017 = "MongoDB Atlas TLS" }
    content {
      description = egress.value
      protocol    = "tcp"
      from_port   = tonumber(egress.key)
      to_port     = tonumber(egress.key)
      cidr_blocks = ["0.0.0.0/0"]
    }
  }
}

resource "aws_iam_role" "ssm" {
  name_prefix = "campusswap-demo-ssm-"
  assume_role_policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [{ Effect = "Allow", Principal = { Service = "ec2.amazonaws.com" }, Action = "sts:AssumeRole" }]
  })
}

resource "aws_iam_role_policy_attachment" "ssm" {
  role       = aws_iam_role.ssm.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "ssm" {
  name_prefix = "campusswap-demo-ssm-"
  role        = aws_iam_role.ssm.name
}

resource "aws_instance" "demo" {
  ami                         = data.aws_ami.ubuntu.id
  instance_type               = "t3.small"
  subnet_id                   = data.aws_subnet.demo.id
  vpc_security_group_ids      = [aws_security_group.demo.id]
  associate_public_ip_address = true
  iam_instance_profile        = aws_iam_instance_profile.ssm.name

  credit_specification {
    cpu_credits = "standard"
  }

  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 1
  }

  root_block_device {
    encrypted             = true
    volume_type           = "gp3"
    volume_size           = 20
    delete_on_termination = true
  }

  tags       = { Name = "campusswap-demo" }
  depends_on = [aws_iam_role_policy_attachment.ssm]
}

output "instance_id" {
  description = "Target for the approved operator's Session Manager connection."
  value       = aws_instance.demo.id
}

output "public_ipv4" {
  description = "Current HTTPS certificate IP and Atlas /32 allowlist address."
  value       = aws_instance.demo.public_ip
}
