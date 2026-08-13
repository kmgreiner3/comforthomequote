terraform {
  required_version = ">= 1.9"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
  backend "s3" {
    bucket  = "chq-tfstate-984950935097"
    key     = "bootstrap/terraform.tfstate"
    region  = "us-east-1"
    profile = "chq-comforthomequote"
  }
}

provider "aws" {
  region  = "us-east-1"
  profile = "chq-comforthomequote"
  default_tags {
    tags = {
      project    = "comforthomequote"
      managed_by = "terraform"
      stack      = "bootstrap"
    }
  }
}

resource "aws_s3_bucket" "tfstate" {
  bucket = "chq-tfstate-984950935097"
}

resource "aws_s3_bucket_versioning" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "tfstate" {
  bucket                  = aws_s3_bucket.tfstate.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
