output "api_id" {
  value = aws_apigatewayv2_api.chq_api.id
}

# Bare host, for use as a CloudFront custom origin domain_name (no scheme).
output "api_domain_name" {
  value = replace(aws_apigatewayv2_api.chq_api.api_endpoint, "https://", "")
}

output "visualizer_bucket" {
  value = aws_s3_bucket.visualizer.bucket
}

output "table_name" {
  value = aws_dynamodb_table.api.name
}
