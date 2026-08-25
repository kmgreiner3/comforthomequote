data "terraform_remote_state" "api" {
  backend = "s3"
  config = {
    bucket  = "chq-tfstate-984950935097"
    key     = "api/terraform.tfstate"
    region  = "us-east-1"
    profile = "chq-comforthomequote"
  }
}

resource "aws_cloudfront_function" "gate" {
  name    = "chq-preview-gate"
  runtime = "cloudfront-js-2.0"
  publish = true
  code    = file("${path.module}/gate-function.js")
}

resource "aws_cloudfront_origin_access_control" "site" {
  name                              = "chq-site-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "site" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "comforthomequote.com static site"
  default_root_object = "index.html"
  aliases             = [local.domain, "www.${local.domain}"]
  price_class         = "PriceClass_100"

  origin {
    domain_name              = aws_s3_bucket.site.bucket_regional_domain_name
    origin_id                = "s3-site"
    origin_access_control_id = aws_cloudfront_origin_access_control.site.id
  }

  # Plan 4: HTTP API Gateway origin for same-origin /api/* calls. No
  # function association here (see ordered_cache_behavior below) - the
  # preview gate only guards the default (page) behavior.
  origin {
    domain_name = data.terraform_remote_state.api.outputs.api_domain_name
    origin_id   = "api"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    target_origin_id       = "s3-site"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true
    # AWS managed policy: CachingOptimized
    cache_policy_id = "658327ea-f89d-4fab-a63d-7e88639e58f6"

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.gate.arn
    }
  }

  # Plan 4: same-origin API. Cache disabled, all methods, no gate function
  # (direct anonymous hits reach the API; presigned upload flows and health
  # checks must not be redirected by the preview gate).
  ordered_cache_behavior {
    path_pattern           = "/api/*"
    target_origin_id       = "api"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true
    # AWS managed policy: CachingDisabled
    cache_policy_id = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad"
    # AWS managed policy: AllViewerExceptHostHeader
    origin_request_policy_id = "b689b0a8-53d0-40ab-baf2-68738e2966ac"
  }

  # SPA routing: unknown paths fall through to index.html. Only 403 is
  # mapped: the site bucket policy grants s3:GetObject but not
  # s3:ListBucket, so a missing SPA route always comes back from S3 as 403
  # (not 404) via OAC. A 404 mapping is deliberately NOT configured here:
  # custom_error_response applies distribution-wide regardless of which
  # cache behavior/origin produced the status code, so mapping 404 would
  # also rewrite genuine 404 JSON responses from the /api/* origin (e.g.
  # visualize/generate on an unknown uploadId) into a 200 index.html page.
  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate_validation.site.certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }
}
