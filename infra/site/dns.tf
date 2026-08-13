locals {
  site_records = toset([local.domain, "www.${local.domain}"])
}

resource "aws_route53_record" "a" {
  provider = aws.management
  for_each = local.site_records
  zone_id  = local.zone_id
  name     = each.value
  type     = "A"
  alias {
    name                   = aws_cloudfront_distribution.site.domain_name
    zone_id                = "Z2FDTNDATAQYW2" # CloudFront's fixed hosted zone id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "aaaa" {
  provider = aws.management
  for_each = local.site_records
  zone_id  = local.zone_id
  name     = each.value
  type     = "AAAA"
  alias {
    name                   = aws_cloudfront_distribution.site.domain_name
    zone_id                = "Z2FDTNDATAQYW2"
    evaluate_target_health = false
  }
}
