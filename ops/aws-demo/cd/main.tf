terraform {
  required_version = "~> 1.14"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

variable "aws_account_id" {
  type        = string
  description = "ID of the existing demo AWS account."
  validation {
    condition     = can(regex("^[0-9]{12}$", var.aws_account_id))
    error_message = "Supply the reviewed 12-digit AWS account ID."
  }
}

variable "instance_id" {
  type        = string
  description = "ID of the existing CampusSwap demo instance in us-east-1."
  validation {
    condition     = can(regex("^i-[0-9a-f]{17}$", var.instance_id))
    error_message = "Supply the reviewed CampusSwap EC2 instance ID."
  }
}

variable "create_github_oidc_provider" {
  type        = bool
  default     = false
  description = "Enable only after verifying this account has no GitHub OIDC provider."
}

provider "aws" {
  region              = "us-east-1"
  allowed_account_ids = [var.aws_account_id]

  default_tags {
    tags = { Project = "CampusSwap", Environment = "synthetic-demo", ManagedBy = "Terraform" }
  }
}

locals {
  issuer       = "token.actions.githubusercontent.com"
  provider_arn = var.create_github_oidc_provider ? aws_iam_openid_connect_provider.github[0].arn : "arn:aws:iam::${var.aws_account_id}:oidc-provider/${local.issuer}"
  deploy_code  = base64encode(replace(file("${path.module}/deploy.sh"), "\r\n", "\n"))
}

resource "aws_iam_openid_connect_provider" "github" {
  count          = var.create_github_oidc_provider ? 1 : 0
  url            = "https://${local.issuer}"
  client_id_list = ["sts.amazonaws.com"]
}

resource "aws_ssm_document" "deploy" {
  name            = "CampusSwapDeployDemo"
  document_type   = "Session"
  document_format = "JSON"
  content = jsonencode({
    schemaVersion = "1.0"
    sessionType   = "NonInteractiveCommands"
    description   = "Deploy an approved CampusSwap image digest and restore its predecessor on failure."
    parameters = {
      Digest = {
        type           = "String"
        allowedPattern = "^sha256:[a-f0-9]{64}$"
      }
    }
    properties = {
      linux = {
        commands      = "printf '%s' '${local.deploy_code}' | /usr/bin/base64 -d | /usr/bin/timeout --kill-after=150s 420s /usr/bin/bash -s -- '{{ Digest }}'"
        runAsElevated = true
      }
    }
  })
}

resource "aws_iam_role" "deploy" {
  name = "campusswap-demo-deploy"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Action    = "sts:AssumeRoleWithWebIdentity"
      Principal = { Federated = local.provider_arn }
      Condition = {
        StringEquals = {
          "${local.issuer}:aud"           = "sts.amazonaws.com"
          "${local.issuer}:sub"           = "repo:AdityaParashar619/campus_swap:environment:campusswap-demo"
          "${local.issuer}:repository_id" = "1212916913"
          "${local.issuer}:ref"           = "refs/heads/main"
          "${local.issuer}:workflow"      = "Deploy CampusSwap demo"
          "${local.issuer}:environment"   = "campusswap-demo"
        }
      }
    }]
  })
}

resource "aws_iam_role_policy" "deploy" {
  name = "campusswap-demo-ssm"
  role = aws_iam_role.deploy.name
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "StartOnlyTheDemoInstanceSession"
        Effect    = "Allow"
        Action    = "ssm:StartSession"
        Resource  = "arn:aws:ec2:us-east-1:${var.aws_account_id}:instance/${var.instance_id}"
        Condition = { Bool = { "ssm:SessionDocumentAccessCheck" = "true" } }
      },
      {
        Sid      = "AllowOnlyTheDeploymentSessionDocument"
        Effect   = "Allow"
        Action   = "ssm:StartSession"
        Resource = aws_ssm_document.deploy.arn
      },
      {
        Sid       = "OpenAndEndOnlyTheCallerSession"
        Effect    = "Allow"
        Action    = ["ssmmessages:OpenDataChannel", "ssm:TerminateSession"]
        Resource  = "arn:aws:ssm:us-east-1:${var.aws_account_id}:session/*"
        Condition = { StringEquals = { "ssm:resourceTag/aws:ssmmessages:session-id" = "$${aws:userid}" } }
      }
    ]
  })
}

output "deployment_role_arn" {
  value = aws_iam_role.deploy.arn
}
