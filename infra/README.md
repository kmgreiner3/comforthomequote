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
