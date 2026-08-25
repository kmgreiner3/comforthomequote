locals {
  visualizer_bucket_name = "chq-visualizer-984950935097"
  api_table_name         = "chq-api"
  google_key_param_name  = "/chq/google-api-key"
  nova_canvas_model_arn  = "arn:aws:bedrock:us-east-1::foundation-model/amazon.nova-canvas-v1:0"
  allowed_origins = [
    "https://comforthomequote.com",
    "https://www.comforthomequote.com",
  ]
}

# --- S3: uploads + renders for the visualizer ---------------------------

resource "aws_s3_bucket" "visualizer" {
  bucket = local.visualizer_bucket_name
}

resource "aws_s3_bucket_public_access_block" "visualizer" {
  bucket                  = aws_s3_bucket.visualizer.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "visualizer" {
  bucket = aws_s3_bucket.visualizer.id

  rule {
    id     = "expire-uploads"
    status = "Enabled"
    filter {
      prefix = "uploads/"
    }
    expiration {
      days = 30
    }
  }

  rule {
    id     = "expire-renders"
    status = "Enabled"
    filter {
      prefix = "renders/"
    }
    expiration {
      days = 30
    }
  }

  rule {
    id     = "expire-maps"
    status = "Enabled"
    filter {
      prefix = "maps/"
    }
    expiration {
      days = 30
    }
  }
}

resource "aws_s3_bucket_cors_configuration" "visualizer" {
  bucket = aws_s3_bucket.visualizer.id

  cors_rule {
    allowed_methods = ["PUT", "GET"]
    allowed_origins = local.allowed_origins
    allowed_headers = ["*"]
    max_age_seconds = 3000
  }
}

# --- DynamoDB: upload metadata + rate-limit counters ---------------------

resource "aws_dynamodb_table" "api" {
  name         = local.api_table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pk"

  attribute {
    name = "pk"
    type = "S"
  }

  ttl {
    attribute_name = "expiresAt"
    enabled        = true
  }
}

# --- SSM: Google Solar/Geocoding API key placeholder ---------------------
# Real value is set out-of-band (aws ssm put-parameter --overwrite) once the
# GCP key exists; Terraform never touches it again after initial creation.

resource "aws_ssm_parameter" "google_api_key" {
  name  = local.google_key_param_name
  type  = "SecureString"
  value = "unset"

  lifecycle {
    ignore_changes = [value]
  }
}
