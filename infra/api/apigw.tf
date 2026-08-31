resource "aws_apigatewayv2_api" "chq_api" {
  name          = "chq-api"
  protocol_type = "HTTP"

  # NOTE: disable_execute_api_endpoint is deliberately NOT set. CloudFront's
  # /api/* origin is this API's execute-api domain, so disabling it cuts off
  # CloudFront too (verified live 2026-08-31: every route 404'd until this
  # was reverted). Locking the API to CloudFront needs a shared-secret origin
  # header check or a custom domain first.
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.chq_api.id
  name        = "$default"
  auto_deploy = true
}

# --- measure ---------------------------------------------------------

resource "aws_apigatewayv2_integration" "measure" {
  api_id                 = aws_apigatewayv2_api.chq_api.id
  integration_type       = "AWS_PROXY"
  integration_method     = "POST"
  integration_uri        = aws_lambda_function.measure.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "measure" {
  api_id    = aws_apigatewayv2_api.chq_api.id
  route_key = "POST /api/measure"
  target    = "integrations/${aws_apigatewayv2_integration.measure.id}"
}

resource "aws_lambda_permission" "measure" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.measure.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.chq_api.execution_arn}/*/*"
}

# --- visualize/upload --------------------------------------------------

resource "aws_apigatewayv2_integration" "viz_upload" {
  api_id                 = aws_apigatewayv2_api.chq_api.id
  integration_type       = "AWS_PROXY"
  integration_method     = "POST"
  integration_uri        = aws_lambda_function.viz_upload.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "viz_upload" {
  api_id    = aws_apigatewayv2_api.chq_api.id
  route_key = "POST /api/visualize/upload"
  target    = "integrations/${aws_apigatewayv2_integration.viz_upload.id}"
}

resource "aws_lambda_permission" "viz_upload" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.viz_upload.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.chq_api.execution_arn}/*/*"
}

# --- visualize/generate -------------------------------------------------

resource "aws_apigatewayv2_integration" "viz_generate" {
  api_id                 = aws_apigatewayv2_api.chq_api.id
  integration_type       = "AWS_PROXY"
  integration_method     = "POST"
  integration_uri        = aws_lambda_function.viz_generate.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "viz_generate" {
  api_id    = aws_apigatewayv2_api.chq_api.id
  route_key = "POST /api/visualize/generate"
  target    = "integrations/${aws_apigatewayv2_integration.viz_generate.id}"
}

resource "aws_lambda_permission" "viz_generate" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.viz_generate.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.chq_api.execution_arn}/*/*"
}

# --- address-suggest -----------------------------------------------------

resource "aws_apigatewayv2_integration" "address_suggest" {
  api_id                 = aws_apigatewayv2_api.chq_api.id
  integration_type       = "AWS_PROXY"
  integration_method     = "POST"
  integration_uri        = aws_lambda_function.address_suggest.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "address_suggest" {
  api_id    = aws_apigatewayv2_api.chq_api.id
  route_key = "POST /api/address-suggest"
  target    = "integrations/${aws_apigatewayv2_integration.address_suggest.id}"
}

resource "aws_lambda_permission" "address_suggest" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.address_suggest.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.chq_api.execution_arn}/*/*"
}
