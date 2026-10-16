terraform {
  required_version = ">= 1.7.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.50.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

variable "aws_region" {
  default = "us-east-1"
}

# --- S3 Object Storage with KMS & 24h Purge Lifecycle ---
resource "aws_kms_key" "pdfforge_kms" {
  description             = "KMS Key for PDFForge AI Document Encryption at Rest"
  deletion_window_in_days = 30
  enable_key_rotation     = true
}

resource "aws_s3_bucket" "documents" {
  bucket = "pdfforge-enterprise-documents-${var.aws_region}"
}

resource "aws_s3_bucket_server_side_encryption_configuration" "s3_kms" {
  bucket = aws_s3_bucket.documents.id
  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.pdfforge_kms.arn
      sse_algorithm     = "aws:kms"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "purge_ephemeral_docs" {
  bucket = aws_s3_bucket.documents.id

  rule {
    id     = "auto-purge-after-24-hours"
    status = "Enabled"

    expiration {
      days = 1 # Ephemeral zero retention compliance
    }

    noncurrent_version_expiration {
      noncurrent_days = 1
    }
  }
}

resource "aws_s3_bucket_cors_configuration" "client_direct_upload" {
  bucket = aws_s3_bucket.documents.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["PUT", "POST", "GET"]
    allowed_origins = ["https://pdfforge.ai", "https://*.pdfforge.ai"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3600
  }
}

# --- AWS EKS Cluster ---
module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 20.0"

  cluster_name    = "pdfforge-production-eks"
  cluster_version = "1.30"

  vpc_id     = var.vpc_id
  subnet_ids = var.private_subnet_ids

  eks_managed_node_groups = {
    control_plane = {
      min_size     = 3
      max_size     = 10
      desired_size = 3
      instance_types = ["c6i.xlarge"]
    }
    worker_nodes = {
      min_size     = 5
      max_size     = 80
      desired_size = 8
      instance_types = ["c6i.2xlarge", "c7g.2xlarge"]
    }
  }
}
