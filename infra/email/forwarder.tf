# --- S3: raw inbound messages, 90-day retention ---------------------------

resource "aws_s3_bucket" "mail" {
  bucket = "chq-mail-984950935097"
}

resource "aws_s3_bucket_public_access_block" "mail" {
  bucket                  = aws_s3_bucket.mail.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "mail" {
  bucket = aws_s3_bucket.mail.id
  rule {
    id     = "expire-inbound"
    status = "Enabled"
    filter {
      prefix = "inbound/"
    }
    expiration {
      days = 90
    }
  }
}

data "aws_caller_identity" "current" {}

resource "aws_s3_bucket_policy" "mail_ses_write" {
  bucket = aws_s3_bucket.mail.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowSESPuts"
        Effect    = "Allow"
        Principal = { Service = "ses.amazonaws.com" }
        Action    = "s3:PutObject"
        Resource  = "${aws_s3_bucket.mail.arn}/inbound/*"
        Condition = {
          StringEquals = { "aws:SourceAccount" = data.aws_caller_identity.current.account_id }
        }
      }
    ]
  })
}

# --- Forwarder lambda ------------------------------------------------------

data "archive_file" "forwarder" {
  type        = "zip"
  source_dir  = "${path.module}/forwarder"
  output_path = "${path.module}/build/forwarder.zip"
}

data "aws_iam_policy_document" "lambda_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "forwarder" {
  name               = "chq-mail-forwarder"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

resource "aws_iam_role_policy_attachment" "forwarder_basic" {
  role       = aws_iam_role.forwarder.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

data "aws_iam_policy_document" "forwarder" {
  statement {
    sid       = "ReadInboundMail"
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.mail.arn}/inbound/*"]
  }
  statement {
    sid       = "ForwardViaSes"
    actions   = ["ses:SendEmail", "ses:SendRawEmail"]
    resources = ["*"]
    # Only as the site's own identity, never arbitrary senders.
    condition {
      test     = "StringEquals"
      variable = "ses:FromAddress"
      values   = [local.inbox_address]
    }
  }
}

resource "aws_iam_role_policy" "forwarder" {
  name   = "chq-mail-forwarder"
  role   = aws_iam_role.forwarder.id
  policy = data.aws_iam_policy_document.forwarder.json
}

resource "aws_lambda_function" "forwarder" {
  function_name    = "chq-mail-forwarder"
  role             = aws_iam_role.forwarder.arn
  handler          = "index.handler"
  runtime          = "nodejs22.x"
  memory_size      = 256
  timeout          = 30
  filename         = data.archive_file.forwarder.output_path
  source_code_hash = data.archive_file.forwarder.output_base64sha256

  environment {
    variables = {
      BUCKET       = aws_s3_bucket.mail.bucket
      KEY_PREFIX   = "inbound/"
      FROM_ADDRESS = local.inbox_address
      FORWARD_TO   = join(",", local.forward_to)
    }
  }
}

resource "aws_lambda_permission" "ses_invoke" {
  statement_id   = "AllowSESInvoke"
  action         = "lambda:InvokeFunction"
  function_name  = aws_lambda_function.forwarder.function_name
  principal      = "ses.amazonaws.com"
  source_account = data.aws_caller_identity.current.account_id
}
