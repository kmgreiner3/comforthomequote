# ComfortHomeQuote Plan 2: Terraform Infrastructure + CI

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the AWS foundation in the comforthomequote account — Terraform remote state, the static-site serving stack (S3 + CloudFront + ACM + DNS), and GitHub OIDC CI — so Plans 3–4 have somewhere to deploy.

**Architecture:** Three independent Terraform stacks with separate state keys in one S3 state bucket: `bootstrap` (the bucket itself), `site` (S3/CloudFront/ACM/Route53), `ci` (GitHub OIDC provider + least-privilege deploy role). DNS records write cross-account into the management-account zone via a provider alias. GitHub Actions runs tests only in this plan; Terraform applies stay local via SSO.

**Tech Stack:** Terraform ≥1.9 (installed: 1.9.2), AWS provider ~> 6.0, GitHub Actions, us-east-1 everywhere.

**Spec:** `docs/superpowers/specs/2026-08-13-comforthomequote-phase1-design.md`

## Global Constraints

- Workload account: `comforthomequote` **984950935097** — AWS profile `chq-comforthomequote`. DNS zone `Z09657963VZ2063QHF7JD` (comforthomequote.com) lives in management **511661663518** — profile `chq-management`, used ONLY via provider alias for Route53 records.
- Region us-east-1 for everything (required for CloudFront ACM certs anyway).
- Global-namespace resources are prefixed `chq-`: buckets `chq-tfstate-984950935097`, `chq-site-984950935097`; IAM role `chq-github-deploy`.
- State keys: `bootstrap/terraform.tfstate`, `site/terraform.tfstate`, `ci/terraform.tfstate`.
- No state locking yet (Terraform 1.9 lacks `use_lockfile`; single operator). When Terraform is upgraded to ≥1.10, add `use_lockfile = true` to each backend block — one line each, noted in infra/README.
- Cost ceiling: fixed ≤ ~$1/mo (S3 pennies + CloudFront free tier; ACM, OIDC, Route53 records free). No KMS keys, no WAF, no DynamoDB.
- No secrets in the repo. CI gets AWS access ONLY via OIDC role assumption; role trust restricted to `repo:kmgreiner3/comforthomequote:ref:refs/heads/main`.
- Every task: `terraform fmt -check` and `terraform validate` clean before apply; review `terraform plan` resource list before `apply -auto-approve`; conventional commits.
- `.gitignore` already excludes `*.tfstate*` and `.terraform/` — bootstrap's pre-migration local state must never be committed.

---

### Task 1: Bootstrap stack — remote state bucket

**Files:**
- Create: `infra/bootstrap/main.tf`, `infra/README.md`

**Interfaces:**
- Consumes: nothing (first infra task)
- Produces: S3 bucket `chq-tfstate-984950935097` (versioned, encrypted, private) that every stack's `backend "s3"` block uses.

- [ ] **Step 1: Write the stack**

`infra/bootstrap/main.tf`:
```hcl
terraform {
  required_version = ">= 1.9"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
  # backend "s3" is added in Step 4 after the bucket exists (state migration)
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
```

`infra/README.md`:
```markdown
# Infrastructure

Terraform stacks, applied locally via AWS SSO (`aws sso login --profile chq-comforthomequote`).
CI does not run Terraform.

| Stack | State key | Purpose |
|---|---|---|
| bootstrap/ | bootstrap/terraform.tfstate | S3 remote-state bucket |
| site/ | site/terraform.tfstate | S3 + CloudFront + ACM + DNS for comforthomequote.com |
| ci/ | ci/terraform.tfstate | GitHub OIDC provider + deploy role |

DNS zone lives in the management account (511661663518); the site stack writes
records cross-account via a `chq-management` provider alias.

State locking: not enabled (Terraform 1.9). After upgrading to ≥1.10, add
`use_lockfile = true` to each stack's backend block.
```

- [ ] **Step 2: Validate**

Run: `cd infra/bootstrap && terraform init && terraform fmt -check && terraform validate`
Expected: init succeeds (local backend), fmt silent, "Success! The configuration is valid."

- [ ] **Step 3: Plan and apply**

Run: `terraform plan` — expect exactly 4 to add (bucket, versioning, sse, public access block), 0 to change/destroy. Then `terraform apply -auto-approve`.
Expected: "Apply complete! Resources: 4 added."

- [ ] **Step 4: Migrate bootstrap's own state into the bucket**

Append to the `terraform` block in `infra/bootstrap/main.tf` (replacing the placeholder comment):
```hcl
  backend "s3" {
    bucket  = "chq-tfstate-984950935097"
    key     = "bootstrap/terraform.tfstate"
    region  = "us-east-1"
    profile = "chq-comforthomequote"
  }
```
Run: `terraform init -migrate-state` (answer "yes" to copy). Then delete the local files: `rm -f terraform.tfstate terraform.tfstate.backup`.

- [ ] **Step 5: Verify**

Run: `aws s3api get-bucket-versioning --bucket chq-tfstate-984950935097 --profile chq-comforthomequote --query Status` → `"Enabled"`, and `aws s3 ls s3://chq-tfstate-984950935097/bootstrap/ --profile chq-comforthomequote` → shows `terraform.tfstate`.

- [ ] **Step 6: Commit**

```bash
git add infra/
git commit -m "feat(infra): bootstrap remote-state bucket"
```

---

### Task 2: Site stack — S3, ACM, CloudFront, DNS

**Files:**
- Create: `infra/site/providers.tf`, `infra/site/locals.tf`, `infra/site/s3.tf`, `infra/site/acm.tf`, `infra/site/cloudfront.tf`, `infra/site/dns.tf`, `infra/site/outputs.tf`

**Interfaces:**
- Consumes: state bucket (Task 1)
- Produces: outputs `site_bucket` (name), `distribution_id`, `distribution_arn`, `distribution_domain` — Task 3 reads these via `terraform_remote_state`. Serving: https://comforthomequote.com + www with a placeholder page.

- [ ] **Step 1: Write the stack**

`infra/site/providers.tf`:
```hcl
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
    key     = "site/terraform.tfstate"
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
      stack      = "site"
    }
  }
}

# Management account — Route53 zone only. Never create other resources here.
provider "aws" {
  alias   = "management"
  region  = "us-east-1"
  profile = "chq-management"
}
```

`infra/site/locals.tf`:
```hcl
locals {
  domain  = "comforthomequote.com"
  zone_id = "Z09657963VZ2063QHF7JD" # comforthomequote.com zone, management account
}
```

`infra/site/s3.tf`:
```hcl
resource "aws_s3_bucket" "site" {
  bucket = "chq-site-984950935097"
}

resource "aws_s3_bucket_public_access_block" "site" {
  bucket                  = aws_s3_bucket.site.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# CloudFront (OAC) is the only allowed reader.
resource "aws_s3_bucket_policy" "site" {
  bucket = aws_s3_bucket.site.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "AllowCloudFrontOAC"
      Effect    = "Allow"
      Principal = { Service = "cloudfront.amazonaws.com" }
      Action    = "s3:GetObject"
      Resource  = "${aws_s3_bucket.site.arn}/*"
      Condition = {
        StringEquals = { "AWS:SourceArn" = aws_cloudfront_distribution.site.arn }
      }
    }]
  })
}

resource "aws_s3_object" "placeholder" {
  bucket       = aws_s3_bucket.site.id
  key          = "index.html"
  content_type = "text/html"
  content      = "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"><title>ComfortHomeQuote</title></head><body style=\"font-family:system-ui;display:grid;place-items:center;min-height:100vh;margin:0\"><main style=\"text-align:center\"><h1>ComfortHomeQuote</h1><p>Instant, transparent roof estimates for Florida homeowners.</p><p>Coming soon.</p></main></body></html>"
}
```

`infra/site/acm.tf`:
```hcl
resource "aws_acm_certificate" "site" {
  domain_name               = local.domain
  subject_alternative_names = ["www.${local.domain}"]
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "cert_validation" {
  provider = aws.management
  for_each = {
    for dvo in aws_acm_certificate.site.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      type   = dvo.resource_record_type
      record = dvo.resource_record_value
    }
  }
  zone_id         = local.zone_id
  name            = each.value.name
  type            = each.value.type
  ttl             = 300
  records         = [each.value.record]
  allow_overwrite = true
}

resource "aws_acm_certificate_validation" "site" {
  certificate_arn         = aws_acm_certificate.site.arn
  validation_record_fqdns = [for r in aws_route53_record.cert_validation : r.fqdn]
}
```

`infra/site/cloudfront.tf`:
```hcl
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

  default_cache_behavior {
    target_origin_id       = "s3-site"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true
    # AWS managed policy: CachingOptimized
    cache_policy_id = "658327ea-f89d-4fab-a63d-7e88639e58f6"
  }

  # SPA routing (Plan 4): unknown paths fall through to index.html
  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"
  }
  custom_error_response {
    error_code         = 404
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
```

`infra/site/dns.tf`:
```hcl
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
```

`infra/site/outputs.tf`:
```hcl
output "site_bucket" {
  value = aws_s3_bucket.site.bucket
}

output "distribution_id" {
  value = aws_cloudfront_distribution.site.id
}

output "distribution_arn" {
  value = aws_cloudfront_distribution.site.arn
}

output "distribution_domain" {
  value = aws_cloudfront_distribution.site.domain_name
}
```

- [ ] **Step 2: Validate**

Run: `cd infra/site && terraform init && terraform fmt -check && terraform validate`
Expected: backend initializes against the state bucket; validation succeeds.

- [ ] **Step 3: Sanity-check registrar delegation (read-only)**

Run:
```bash
aws route53 get-hosted-zone --id Z09657963VZ2063QHF7JD --profile chq-management --query 'DelegationSet.NameServers' --output json
aws route53domains get-domain-detail --domain-name comforthomequote.com --region us-east-1 --profile chq-management --query 'Nameservers[].Name' --output json
```
Expected: the two lists match (registrar points at this zone). If they don't match, STOP and report BLOCKED — cert validation would hang forever.

- [ ] **Step 4: Plan and apply**

Run: `terraform plan` — expect ~15 to add (2 S3 config + bucket + object + policy, cert + 2 validation records + validation waiter, OAC + distribution, 4 alias records), 0 destroy, and both Route53 records clearly targeting zone Z09657963VZ2063QHF7JD. Then `terraform apply -auto-approve`.
Expected: apply completes in 5–20 minutes (ACM DNS validation + CloudFront deployment are the slow parts). "Apply complete!" with the 4 outputs printed.

- [ ] **Step 5: Verify serving**

Run: `curl -sI https://comforthomequote.com | head -3 && curl -s https://comforthomequote.com | grep -o '<h1>[^<]*</h1>'`
Expected: `HTTP/2 200` and `<h1>ComfortHomeQuote</h1>`. (If DNS hasn't propagated to your resolver yet, verify via the distribution directly: `curl -sI https://$(cd infra/site && terraform output -raw distribution_domain)` → 200, then re-check the domain before Task 5.)

- [ ] **Step 6: Commit**

```bash
git add infra/site
git commit -m "feat(infra): site stack - S3/CloudFront/ACM/DNS for comforthomequote.com"
```

---

### Task 3: CI stack — GitHub OIDC provider + deploy role

**Files:**
- Create: `infra/ci/providers.tf`, `infra/ci/oidc.tf`, `infra/ci/outputs.tf`

**Interfaces:**
- Consumes: site stack outputs (`site_bucket`, `distribution_id`, `distribution_arn`) via `terraform_remote_state`
- Produces: IAM role `chq-github-deploy` (output `deploy_role_arn`) that Plan 4's deploy workflow assumes via `aws-actions/configure-aws-credentials`.

- [ ] **Step 1: Write the stack**

`infra/ci/providers.tf`:
```hcl
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
    key     = "ci/terraform.tfstate"
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
      stack      = "ci"
    }
  }
}
```

`infra/ci/oidc.tf`:
```hcl
data "terraform_remote_state" "site" {
  backend = "s3"
  config = {
    bucket  = "chq-tfstate-984950935097"
    key     = "site/terraform.tfstate"
    region  = "us-east-1"
    profile = "chq-comforthomequote"
  }
}

resource "aws_iam_openid_connect_provider" "github" {
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
  # AWS validates GitHub's cert against its own trust store since 2023;
  # thumbprints are still required fields. These are GitHub's published values.
  thumbprint_list = [
    "6938fd4d98bab03faadb97b34396831e3780aea1",
    "1c58a3a8518e8759bf075b76b750d4f2df264fcd",
  ]
}

data "aws_iam_policy_document" "assume" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:kmgreiner3/comforthomequote:ref:refs/heads/main"]
    }
  }
}

resource "aws_iam_role" "github_deploy" {
  name               = "chq-github-deploy"
  assume_role_policy = data.aws_iam_policy_document.assume.json
}

data "aws_iam_policy_document" "deploy" {
  statement {
    sid       = "SiteBucketList"
    actions   = ["s3:ListBucket"]
    resources = ["arn:aws:s3:::${data.terraform_remote_state.site.outputs.site_bucket}"]
  }
  statement {
    sid       = "SiteBucketObjects"
    actions   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
    resources = ["arn:aws:s3:::${data.terraform_remote_state.site.outputs.site_bucket}/*"]
  }
  statement {
    sid       = "Invalidate"
    actions   = ["cloudfront:CreateInvalidation"]
    resources = [data.terraform_remote_state.site.outputs.distribution_arn]
  }
}

resource "aws_iam_role_policy" "deploy" {
  name   = "site-deploy"
  role   = aws_iam_role.github_deploy.id
  policy = data.aws_iam_policy_document.deploy.json
}
```

`infra/ci/outputs.tf`:
```hcl
output "deploy_role_arn" {
  value = aws_iam_role.github_deploy.arn
}
```

- [ ] **Step 2: Validate**

Run: `cd infra/ci && terraform init && terraform fmt -check && terraform validate`
Expected: clean.

- [ ] **Step 3: Plan and apply**

Run: `terraform plan` — expect 3 to add (OIDC provider, role, role policy); confirm the trust policy's sub condition reads exactly `repo:kmgreiner3/comforthomequote:ref:refs/heads/main`. Then `terraform apply -auto-approve`.

- [ ] **Step 4: Verify**

Run: `aws iam get-role --role-name chq-github-deploy --profile chq-comforthomequote --query 'Role.AssumeRolePolicyDocument.Statement[0].Condition.StringEquals' --output json`
Expected: shows the aud + sub conditions from Step 1.

- [ ] **Step 5: Commit**

```bash
git add infra/ci
git commit -m "feat(infra): GitHub OIDC provider and chq-github-deploy role"
```

---

### Task 4: GitHub Actions test workflow

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: monorepo test/typecheck scripts (Plan 1)
- Produces: required-check-ready `test` job on every PR and main push. (The deploy workflow arrives with Plan 4 — it will use `deploy_role_arn` from Task 3.)

- [ ] **Step 1: Write the workflow**

`.github/workflows/ci.yml`:
```yaml
name: ci

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run typecheck
```

- [ ] **Step 2: Commit and push**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: run tests and typecheck on PRs and main"
git push
```

- [ ] **Step 3: Verify the run passes**

Run: `gh run watch --exit-status $(gh run list --branch main --workflow ci --limit 1 --json databaseId --jq '.[0].databaseId')`
Expected: exit 0, job `test` green. If it fails, read the log (`gh run view --log-failed`), fix, and re-push before proceeding.

---

### Task 5: End-to-end verification + docs

**Files:**
- Modify: `README.md` (add live-site + infra sections)

**Interfaces:**
- Consumes: everything above
- Produces: verified-live https://comforthomequote.com and documented repo entry points.

- [ ] **Step 1: Verify the domain serves over HTTPS (both hosts)**

Run:
```bash
curl -sI https://comforthomequote.com | head -1
curl -sI https://www.comforthomequote.com | head -1
curl -s https://comforthomequote.com | grep -c ComfortHomeQuote
```
Expected: `HTTP/2 200` twice, grep count ≥ 1. DNS/CF propagation can lag up to ~30 min after Task 2; re-run until green rather than skipping.

- [ ] **Step 2: Document in README**

Append to `README.md`:
```markdown
## Live site

https://comforthomequote.com — S3 + CloudFront (placeholder until the quote flow ships).

## Infrastructure

Terraform in `infra/` (see `infra/README.md`). Applies run locally via AWS SSO;
CI runs tests only. GitHub Actions deploys will use the `chq-github-deploy`
OIDC role (no stored AWS keys).
```

- [ ] **Step 3: Commit and push**

```bash
git add README.md
git commit -m "docs: live site and infrastructure overview"
git push
```

- [ ] **Step 4: Confirm CI is green on main**

Run: `gh run watch --exit-status $(gh run list --branch main --workflow ci --limit 1 --json databaseId --jq '.[0].databaseId')`
Expected: exit 0.
