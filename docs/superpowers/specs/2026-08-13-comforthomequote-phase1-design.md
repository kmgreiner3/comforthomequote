# ComfortHomeQuote — Phase 1 Design: Instant Roof Estimate Flow

**Date:** 2026-08-13
**Status:** Approved pending final spec review
**Owners:** Kyle Greiner (kgreiner), Dylan Nadeau (dnadeau)

## Goal

A simple, transparent web flow where a Florida homeowner enters their address, is guided through a few roof/material questions, and sees a live, line-itemized estimate — **with no email, phone, or signup required to see the quote.** Optional contact only *after* the estimate is shown.

## Product principles

- No lead gate, ever, for seeing the number.
- Transparent math: every estimate shows its line items.
- Real-time: material/option changes update the price instantly.
- Cost floor: fixed infra ≤ ~$2/month; per-quote variable cost ≈ $0.08.

## Approved decisions

| Decision | Choice |
|---|---|
| Architecture | Static SPA + serverless API on AWS (approach A) |
| Roof measurements | Google Solar API (Building Insights) + manual wizard fallback |
| Pricing data | Seed FL-market defaults; Kyle/Dylan refine before launch |
| Domain | comforthomequote.com — registered in Route53 (management acct), zone **stays in management**; app Terraform writes records cross-account |
| Post-quote | Optional contact form + shareable quote link |
| Repo | `kmgreiner3/roofin` → renamed `comforthomequote`, monorepo |
| AWS account | All workload infra in `comforthomequote` (984950935097), us-east-1 |

## Homeowner flow

1. **Address** — one input; on submit we geocode, derive county and HVHZ status (Miami-Dade/Broward high-velocity hurricane zone).
2. **Your roof** — Solar API auto-measurements (area sq ft, dominant pitch, segment count) shown in plain language; user confirms/adjusts stories & complexity. If no Solar coverage: manual wizard (footprint sq ft, stories, pitch picker with reference photos, complexity: simple/average/cut-up). Both paths produce the same `RoofInput` shape.
3. **Material** — photo cards: 3-tab shingle, architectural shingle, standing-seam metal, concrete tile. Live price impact on each card.
4. **Options** — underlayment upgrade (peel & stick), ridge vent, skylights (count), gutters (linear ft), solar-ready prep. Each toggle updates the estimate instantly.
5. **Estimate** — range (point ± band %), expandable line items (materials, labor, permit, tear-off/disposal), monthly-payment slider (configurable APR/term, pure math, no partner), share link `/q/{quoteId}`, optional "get a firm quote" contact form.

## Architecture

- **Frontend:** React + Vite + TypeScript SPA, Tailwind. Hosted: private S3 bucket + CloudFront (OAC), ACM cert (us-east-1), `comforthomequote.com` + `www`.
- **API:** API Gateway HTTP API + Node/TS Lambdas (esbuild-bundled):
  - `POST /api/measure` `{address}` → geocode → Solar Building Insights → `{coverage, areaSqft, pitchDeg, segments, county, hvhz}` (or `{coverage:false, county}`).
  - `POST /api/estimate` `{RoofInput, selections}` → line items + range. (Client computes locally for instant UI; server is source of truth on save.)
  - `POST /api/quotes` → persists inputs + computed estimate + pricing config version → `{quoteId}`.
  - `GET /api/quotes/{id}` → read-only, powers share links.
  - `POST /api/leads` `{quoteId, name, contact, notes}` → optional contact submission.
- **Data:** DynamoDB, single table, on-demand. Items: `QUOTE#{id}` (no PII), `LEAD#{id}` (PII only when voluntarily submitted).
- **Pricing engine:** pure TypeScript package `packages/pricing`, shared client+server. Deterministic: `(RoofInput, Selections, PricingConfig) → Estimate`. Config is versioned JSON in-repo; every saved quote records `configVersion` for reproducibility.

### Pricing formula (seed defaults marked for refinement)

```
squares      = area/100 × (1 + waste%)          waste from complexity/segments
materials    = squares × $/sq by material tier   (material-only: 3-tab 120 / arch 140 / metal 450 / tile 500 — SEED, labor separate)
labor        = squares × $/sq by pitch class (walkable/steep/very steep) × stories factor
permit       = county fee table (7 seeded counties + default) + inspections
hvhz adder   = % on materials+labor when Miami-Dade/Broward (fastening/code)
disposal     = squares × tear-off $/sq
subtotal     = sum × (1 + margin%)
output       = subtotal ± band% (range), full line items
```

## Infra / repo layout (monorepo)

```
app/web/          React SPA
app/api/          Lambda handlers
packages/pricing/ shared pricing engine + config JSON
infra/            Terraform (state: S3 bucket in CHQ acct, native lockfile)
  bootstrap/      state bucket
  ci/             GitHub OIDC provider + deploy role (bound to repo)
  site/           S3, CloudFront, ACM, Route53 records (cross-acct provider → management zone Z09657963VZ2063QHF7JD)
  api/            API GW, Lambdas, DynamoDB, SSM param (GCP key)
.github/workflows/  test → build → deploy (web: S3 sync + CF invalidation; api: lambda update)
```

- Terraform applied locally via SSO profiles (`chq-comforthomequote`; cross-account DNS via `chq-management`). CI deploys app artifacts only (OIDC, no stored keys).
- **Prerequisite:** small GCP project with Solar API + Geocoding API enabled, one restricted API key, stored in SSM Parameter Store (free tier).

## Security / privacy / abuse

- No auth, so: API GW throttling; per-IP daily cap (DynamoDB counter) on `/api/measure` — the only endpoint that costs money per call. No WAF at MVP (fixed $ cost).
- No PII stored unless the homeowner submits the optional contact form.
- Secrets: SSM Parameter Store SecureString only. No AWS keys in GitHub (OIDC).

## Costs

| Item | Monthly |
|---|---|
| Route53 zone | $0.50 (already exists) |
| S3 + CloudFront + Lambda + API GW + DynamoDB | ~$0–1 at MVP traffic (free tiers) |
| Google geocode + Solar per quote | ~$0.08 variable |
| Domain | already paid through 2027 |

## Testing

- `packages/pricing`: golden-case unit tests (per material × pitch × county × HVHZ) — the trust-critical core.
- API: integration tests with mocked Solar/geocode responses (incl. no-coverage fallback).
- E2E: Playwright happy path (address → estimate → share link) in CI before deploy.

## Out of scope (later phases)

3D/photo visualizer, contractor portal, real financing integration, e-sign/deposits, scheduling, full county permit automation, marketplace features.
