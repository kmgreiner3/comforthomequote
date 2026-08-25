# --- Zips: one per handler, built by `npm run build -w @chq/api` into
# app/api/dist/<name>/ before `terraform apply`. ------------------------

data "archive_file" "measure" {
  type        = "zip"
  source_dir  = "${path.module}/../../app/api/dist/measure"
  output_path = "${path.module}/build/measure.zip"
}

data "archive_file" "viz_upload" {
  type        = "zip"
  source_dir  = "${path.module}/../../app/api/dist/vizUpload"
  output_path = "${path.module}/build/vizUpload.zip"
}

data "archive_file" "viz_generate" {
  type        = "zip"
  source_dir  = "${path.module}/../../app/api/dist/vizGenerate"
  output_path = "${path.module}/build/vizGenerate.zip"
}

# --- IAM: one role per function, least privilege -------------------------

data "aws_iam_policy_document" "lambda_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

# measure: reads the Google API key param, writes rate-limit counters.

resource "aws_iam_role" "measure" {
  name               = "chq-measure-lambda"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

resource "aws_iam_role_policy_attachment" "measure_basic" {
  role       = aws_iam_role.measure.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

data "aws_iam_policy_document" "measure" {
  statement {
    sid       = "ReadGoogleApiKey"
    actions   = ["ssm:GetParameter"]
    resources = [aws_ssm_parameter.google_api_key.arn]
  }
  statement {
    sid       = "RateLimitCounters"
    actions   = ["dynamodb:UpdateItem"]
    resources = [aws_dynamodb_table.api.arn]
  }
  statement {
    sid = "PropertyImageCache"
    # s3:GetObject also authorizes HeadObject (there is no separate
    # s3:HeadObject action), matching the viz-generate cache-check pattern.
    actions   = ["s3:GetObject", "s3:PutObject"]
    resources = ["${aws_s3_bucket.visualizer.arn}/maps/*"]
  }
}

resource "aws_iam_role_policy" "measure" {
  name   = "chq-measure"
  role   = aws_iam_role.measure.id
  policy = data.aws_iam_policy_document.measure.json
}

# viz-upload: presigns S3 PUT into uploads/, records upload metadata.

resource "aws_iam_role" "viz_upload" {
  name               = "chq-viz-upload-lambda"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

resource "aws_iam_role_policy_attachment" "viz_upload_basic" {
  role       = aws_iam_role.viz_upload.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

data "aws_iam_policy_document" "viz_upload" {
  statement {
    sid       = "PresignUploadPut"
    actions   = ["s3:PutObject"]
    resources = ["${aws_s3_bucket.visualizer.arn}/uploads/*"]
  }
  statement {
    sid       = "RecordUploadMetadata"
    actions   = ["dynamodb:PutItem", "dynamodb:UpdateItem"]
    resources = [aws_dynamodb_table.api.arn]
  }
}

resource "aws_iam_role_policy" "viz_upload" {
  name   = "chq-viz-upload"
  role   = aws_iam_role.viz_upload.id
  policy = data.aws_iam_policy_document.viz_upload.json
}

# viz-generate: reads the upload, invokes Nova Canvas, writes/reads renders,
# writes rate-limit counters and reads the upload metadata item.

resource "aws_iam_role" "viz_generate" {
  name               = "chq-viz-generate-lambda"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

resource "aws_iam_role_policy_attachment" "viz_generate_basic" {
  role       = aws_iam_role.viz_generate.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

data "aws_iam_policy_document" "viz_generate" {
  statement {
    sid       = "ReadUpload"
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.visualizer.arn}/uploads/*"]
  }
  statement {
    sid       = "ReadWriteRenders"
    actions   = ["s3:GetObject", "s3:PutObject"]
    resources = ["${aws_s3_bucket.visualizer.arn}/renders/*"]
  }
  statement {
    sid       = "InvokeNovaCanvas"
    actions   = ["bedrock:InvokeModel"]
    resources = [local.nova_canvas_model_arn]
  }
  statement {
    sid       = "UploadMetadataAndCaps"
    actions   = ["dynamodb:GetItem", "dynamodb:UpdateItem"]
    resources = [aws_dynamodb_table.api.arn]
  }
}

resource "aws_iam_role_policy" "viz_generate" {
  name   = "chq-viz-generate"
  role   = aws_iam_role.viz_generate.id
  policy = data.aws_iam_policy_document.viz_generate.json
}

# --- Lambda functions -----------------------------------------------------

resource "aws_lambda_function" "measure" {
  function_name    = "chq-measure"
  role             = aws_iam_role.measure.arn
  handler          = "index.handler"
  runtime          = "nodejs22.x"
  memory_size      = 512
  timeout          = 15
  filename         = data.archive_file.measure.output_path
  source_code_hash = data.archive_file.measure.output_base64sha256

  environment {
    variables = {
      TABLE            = aws_dynamodb_table.api.name
      GOOGLE_KEY_PARAM = aws_ssm_parameter.google_api_key.name
      BUCKET           = aws_s3_bucket.visualizer.bucket
    }
  }
}

resource "aws_lambda_function" "viz_upload" {
  function_name    = "chq-viz-upload"
  role             = aws_iam_role.viz_upload.arn
  handler          = "index.handler"
  runtime          = "nodejs22.x"
  memory_size      = 512
  timeout          = 15
  filename         = data.archive_file.viz_upload.output_path
  source_code_hash = data.archive_file.viz_upload.output_base64sha256

  environment {
    variables = {
      BUCKET = aws_s3_bucket.visualizer.bucket
      TABLE  = aws_dynamodb_table.api.name
    }
  }
}

resource "aws_lambda_function" "viz_generate" {
  function_name    = "chq-viz-generate"
  role             = aws_iam_role.viz_generate.arn
  handler          = "index.handler"
  runtime          = "nodejs22.x"
  memory_size      = 1024
  timeout          = 60
  filename         = data.archive_file.viz_generate.output_path
  source_code_hash = data.archive_file.viz_generate.output_base64sha256

  # Task 4 gate: visualizer ships dark. Remove with the visualizer UI task,
  # together with the global daily generate cap and the XFF clientIp fix.
  reserved_concurrent_executions = 0

  environment {
    variables = {
      BUCKET   = aws_s3_bucket.visualizer.bucket
      TABLE    = aws_dynamodb_table.api.name
      MODEL_ID = "amazon.nova-canvas-v1:0"
    }
  }
}
