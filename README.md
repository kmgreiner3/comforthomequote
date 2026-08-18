# ComfortHomeQuote

Instant, transparent roof estimates for Florida homeowners.
Design specs: docs/superpowers/specs/

## packages/pricing

Deterministic pricing engine implementing the client's progressive band model
(see docs/client/pricing-rules.md — INTERNAL; never render per-SQ rates in UI).

```ts
import { configuredTotal, guarantee, estimatedMonthly } from '@chq/pricing';
const total = configuredTotal(27.43, 'tamko-titan-xt', 'peel-stick'); // whole dollars
const monthly = estimatedMonthly(total); // "$X/month (approximately)"
```

Anchor prices from the client are locked in as golden tests.

## Live site

https://comforthomequote.com — S3 + CloudFront (placeholder until the quote flow ships).

## Infrastructure

Terraform in `infra/` (see `infra/README.md`). Applies run locally via AWS SSO;
CI runs tests only. GitHub Actions deploys will use the `chq-github-deploy`
OIDC role (no stored AWS keys).
