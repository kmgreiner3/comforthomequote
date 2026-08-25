# ComfortHomeQuote — Measurement + Visualizer Design (Plan 4)

**Date:** 2026-08-25 · **Status:** Approved (Kyle: Google Solar API primary + Dylan's outline × 1.2 rule; Bedrock visualizer on Amazon Nova Canvas)
**Builds on:** Plan 3 shipped site (gated, auto-deploy). First backend of the project.

## Features

### A. Dynamic roof measurement (address → sized roof)

- **Primary:** Google Solar API `buildingInsights` for the geocoded address. We use the roof's **ground-projected outline area** (`wholeRoofStats.groundAreaMeters2`, converted to sq ft) as "the raw outline of the roof" and apply **Dylan's rule exactly: outline × 1.2** via the existing `sqFromOutline()`. Same formula for satellite-measured and manually-entered outlines; no double-counting of pitch (we deliberately do NOT use the pitched 3D area).
- **Fallback:** existing manual footprint entry, unchanged. (A trace-on-aerial tool is a future option, not in this plan.)
- UX (StepHome): when an address exists, auto-measure on step entry. Found: "We sized your roof from satellite imagery." + Continue + a quiet "Not right? Enter your footprint instead." toggle to the manual input. Not found / API unavailable: manual input as today. **Never display squares or areas** (client rule).
- Costs: geocode ~$0.005 + Solar ~$0.075 per lookup. Per-IP daily cap (20) via DynamoDB counter with TTL.
- **Dependency (Kyle):** a personal GCP project with billing, Solar API + Geocoding API enabled, one API key restricted to those two APIs. Key goes into SSM Parameter Store (SecureString `/chq/google-api-key`); the measure endpoint returns `{available:false}` until the key exists, and the UI silently falls back to manual entry.

### B. "See it on your home" visualizer (Bedrock Nova Canvas)

- Upload a photo of the home (JPEG/PNG/HEIC≤ browser-converted, ≤ 8MB) via presigned S3 PUT. Uploads auto-delete after 30 days (S3 lifecycle); renders too.
- Generation: Nova Canvas (`amazon.nova-canvas-v1:0`, us-east-1) **INPAINTING** with `maskPrompt: "the roof of the house"` and a text prompt built from the selected color's name + Dylan's description ("architectural asphalt shingle roof, <color name>, <key tones from description>, photorealistic"). 1024-max dimension, standard quality (~$0.04/image).
- **Hybrid pregeneration (decision on Dylan's question):** first render for the currently selected color immediately; the frontend then quietly requests the remaining colors of the ACTIVE product line in the background (client-driven, 2 concurrent), all cached in S3 keyed `renders/{uploadId}/{product}/{colorSlug}.png`. Click-through feels instant once warmed; the other line generates lazily on first click.
- Caps: max 40 generations per uploadId, 60 per IP per day (DynamoDB, TTL). Nova Canvas's built-in content filters apply; generation errors surface as a friendly "We couldn't generate this preview" card.
- Disclaimer under every render: "AI preview for inspiration only. Actual color and appearance will vary."
- **Quality gate:** spike (test house, 2 colors, both breakpoints of judgment: mine + Kyle/Dylan's eyeballs) must pass before the visualizer UI task runs. Account is in Bedrock first-use verification (~2h) as of plan writing; retry armed.

## Architecture

- **`infra/api` stack (new):** S3 bucket `chq-visualizer-984950935097` (private, CORS PUT from site origin, 30-day lifecycle); DynamoDB `chq-api` (PK/SK, TTL attr, on-demand); Lambda functions (Node 22, esbuild bundles committed via TF `archive_file` initially): `measure`, `viz-upload`, `viz-generate`; HTTP API Gateway with routes POST /api/measure, /api/visualize/upload, /api/visualize/generate; least-priv roles (Bedrock InvokeModel on the one model ARN, S3 on the one bucket, DDB on the one table, SSM read on the one param).
- **Same-origin via CloudFront:** new `/api/*` cache behavior on distribution E2ORSMTHXNTZ5Y → API GW origin, caching disabled, POST allowed. The preview gate function already runs viewer-request on every path, so the API inherits the password gate during preview (cookie rides along same-origin). `/api/*` added to the gate's redirect-exempt logic? No: API calls come from a gated page that has the cookie; unauthenticated direct API hits get 302, which is fine and desirable.
- **`app/api` workspace:** TS handlers + shared clients, vitest with mocked AWS SDK/Google; esbuild bundle step. Deploy: `terraform apply` picks up rebuilt zips (hash-triggered). CI still tests only; API deploys stay local-apply this plan.
- **Frontend:** store gains `outlineSource: 'satellite' | 'manual'`, `uploadId`; StepHome auto-measure; StepColor gains the visualizer panel (upload card → render viewer above the swatch grid, per-color thumbnails mirroring swatch selection).

## Costs (preview volumes)

Fixed: ~$0 (Lambda/APIGW/DDB free tiers; S3 pennies). Variable: $0.08/measured address, ~$0.04/render (~$0.56 warming IKO line, ~$0.60 Titan). Caps bound worst-case daily spend to a few dollars.

## Out of scope

Trace-on-aerial measuring tool; quotes/leads persistence (next plan); HEIC server-side conversion; visualizer for metal/tile; removing the preview gate.
