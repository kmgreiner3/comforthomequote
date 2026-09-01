# --- Sending identity: the domain, with easy-DKIM ------------------------

resource "aws_sesv2_email_identity" "domain" {
  email_identity = local.domain
}

resource "aws_sesv2_email_identity_mail_from_attributes" "domain" {
  email_identity   = aws_sesv2_email_identity.domain.email_identity
  mail_from_domain = local.mail_from_domain
}

# Sandbox rule: forwarded copies can only be DELIVERED to verified
# addresses until production access is granted. Verifying Dylan's inbox
# sends him a confirmation email he must click once.
resource "aws_sesv2_email_identity" "forward_targets" {
  for_each       = toset(local.forward_to)
  email_identity = each.value
}

# --- DNS (management account zone) ---------------------------------------

resource "aws_route53_record" "dkim" {
  provider = aws.management
  count    = 3
  zone_id  = local.zone_id
  name     = "${aws_sesv2_email_identity.domain.dkim_signing_attributes[0].tokens[count.index]}._domainkey.${local.domain}"
  type     = "CNAME"
  ttl      = 1800
  records  = ["${aws_sesv2_email_identity.domain.dkim_signing_attributes[0].tokens[count.index]}.dkim.amazonses.com"]
}

resource "aws_route53_record" "mail_from_mx" {
  provider = aws.management
  zone_id  = local.zone_id
  name     = local.mail_from_domain
  type     = "MX"
  ttl      = 1800
  records  = ["10 feedback-smtp.us-east-1.amazonses.com"]
}

resource "aws_route53_record" "mail_from_spf" {
  provider = aws.management
  zone_id  = local.zone_id
  name     = local.mail_from_domain
  type     = "TXT"
  ttl      = 1800
  records  = ["v=spf1 include:amazonses.com ~all"]
}

resource "aws_route53_record" "dmarc" {
  provider = aws.management
  zone_id  = local.zone_id
  name     = "_dmarc.${local.domain}"
  type     = "TXT"
  ttl      = 1800
  # p=none to start: monitor without asking receivers to reject anything.
  records = ["v=DMARC1; p=none;"]
}

# Inbound: route the domain's mail to SES receiving in us-east-1.
resource "aws_route53_record" "inbound_mx" {
  provider = aws.management
  zone_id  = local.zone_id
  name     = local.domain
  type     = "MX"
  ttl      = 1800
  records  = ["10 inbound-smtp.us-east-1.amazonaws.com"]
}

# --- Receiving: info@ -> S3 -> forwarder lambda ---------------------------

resource "aws_ses_receipt_rule_set" "inbound" {
  rule_set_name = "chq-inbound"
}

# Only one rule set can be active per account; this account has none other.
resource "aws_ses_active_receipt_rule_set" "inbound" {
  rule_set_name = aws_ses_receipt_rule_set.inbound.rule_set_name
}

resource "aws_ses_receipt_rule" "info" {
  name          = "info-forward"
  rule_set_name = aws_ses_receipt_rule_set.inbound.rule_set_name
  recipients    = [local.inbox_address]
  enabled       = true
  scan_enabled  = true

  s3_action {
    bucket_name       = aws_s3_bucket.mail.bucket
    object_key_prefix = "inbound/"
    position          = 1
  }

  lambda_action {
    function_arn    = aws_lambda_function.forwarder.arn
    invocation_type = "Event"
    position        = 2
  }

  depends_on = [
    aws_s3_bucket_policy.mail_ses_write,
    aws_lambda_permission.ses_invoke,
  ]
}
