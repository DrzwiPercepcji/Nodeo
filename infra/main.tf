terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.region
}

variable "region" {
  type    = string
  default = "eu-central-1"
}

variable "bucket_name" {
  type        = string
  default     = "nodeo-media"
  description = "S3 bucket name for Nodeo media storage"
}

# --- S3 Bucket ---

resource "aws_s3_bucket" "media" {
  bucket = var.bucket_name
}

resource "aws_s3_bucket_versioning" "media" {
  bucket = aws_s3_bucket.media.id
  versioning_configuration {
    status = "Suspended"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "media" {
  bucket = aws_s3_bucket.media.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "media" {
  bucket                  = aws_s3_bucket.media.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "media" {
  bucket = aws_s3_bucket.media.id

  rule {
    id     = "abort-incomplete-uploads"
    status = "Enabled"
    filter {}
    abort_incomplete_multipart_upload {
      days_after_initiation = 1
    }
  }

  rule {
    id     = "trash-expire-7d"
    status = "Enabled"
    filter {
      prefix = "trash/"
    }
    expiration {
      days = 7
    }
  }

  rule {
    id     = "intelligent-tiering-collections"
    status = "Enabled"
    filter {
      prefix = "collections/"
    }
    transition {
      days          = 0
      storage_class = "INTELLIGENT_TIERING"
    }
  }
}

# --- IAM User for Nodeo backend ---

resource "aws_iam_user" "nodeo" {
  name = "nodeo-backend"
}

resource "aws_iam_access_key" "nodeo" {
  user = aws_iam_user.nodeo.name
}

resource "aws_iam_user_policy" "nodeo_s3" {
  name = "nodeo-s3-access"
  user = aws_iam_user.nodeo.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "NodeoS3Access"
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:DeleteObject",
          "s3:HeadObject",
          "s3:ListBucket",
        ]
        Resource = [
          aws_s3_bucket.media.arn,
          "${aws_s3_bucket.media.arn}/*",
        ]
      }
    ]
  })
}

# --- Outputs (for .env) ---

output "s3_bucket" {
  value = aws_s3_bucket.media.bucket
}

output "s3_region" {
  value = var.region
}

output "s3_access_key" {
  value     = aws_iam_access_key.nodeo.id
  sensitive = true
}

output "s3_secret_key" {
  value     = aws_iam_access_key.nodeo.secret
  sensitive = true
}

output "env_snippet" {
  description = "Copy-paste into .env"
  sensitive   = true
  value       = <<-EOT
    S3_BUCKET=${aws_s3_bucket.media.bucket}
    S3_REGION=${var.region}
    S3_ACCESS_KEY=${aws_iam_access_key.nodeo.id}
    S3_SECRET_KEY=${aws_iam_access_key.nodeo.secret}
    # AWS only (omit for MinIO):
    S3_STORAGE_CLASS=INTELLIGENT_TIERING
  EOT
}
