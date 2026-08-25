# ComfortHomeQuote Plan 4: Roof Measurement + Nova Canvas Visualizer

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** First backend: `/api/measure` (Google Solar, Dylan's outline × 1.2 rule) and `/api/visualize/*` (Nova Canvas roof re-rendering), wired into the wizard.

**Spec:** `docs/superpowers/specs/2026-08-25-measure-visualize-design.md` (binding). Site style rules and client pricing-display rules continue to bind (no em dashes/emojis; never show areas/squares to the homeowner).

## Global Constraints

- Account 984950935097, us-east-1, profile chq-comforthomequote. Terraform foreground-only, plan reviewed before apply, fmt/validate clean.
- Model: `amazon.nova-canvas-v1:0` only; IAM scoped to exactly that model ARN. Buckets/tables/params: `chq-visualizer-984950935097`, `chq-api` (DynamoDB, on-demand, TTL attribute `expiresAt`), SSM `/chq/google-api-key` (SecureString, TF placeholder `unset` with `ignore_changes` so the real key persists).
- Area math: `sqft = meters2 × 10.7639104167`; measurement returns the GROUND outline (never the pitched 3D area); the frontend keeps using `sqFromOutline()` (× 1.2) unchanged. Florida-only: geocode results outside FL → `{found:false, reason:"outside-florida"}`.
- Caps (DynamoDB counters, TTL 2 days): measure 20/IP/day; generate 60/IP/day and 40/uploadId total.
- Uploads/renders: S3 lifecycle expiration 30 days; presigned GET URLs for renders; presigned PUT (≤ 8MB, image/jpeg or image/png) for uploads; bucket CORS allows PUT/GET from https://comforthomequote.com and https://www.comforthomequote.com only.
- API reached same-origin via a CloudFront `/api/*` behavior (caching disabled, all methods) to the HTTP API origin; API GW routes carry the literal `/api/...` paths so no rewriting. The preview gate stays as-is (gated pages carry the cookie; direct anonymous API hits 302 — acceptable during preview).
- Every user-facing string added: concise, no em dashes, no emojis. Render disclaimer: "AI preview for inspiration only. Actual color and appearance will vary."
- Conventional commits; root `npm test` + workspace typechecks green before every commit.

## Task 0 (controller): Nova Canvas quality spike — GATE for Task 4

Blocked on AWS first-use verification (retry loop armed). When unlocked: text-to-image a test Florida house, then INPAINTING with maskPrompt "the roof of the house" for Rustic Black and Desert Sand prompts; save originals + renders to `.superpowers/sdd/screens/spike-*.png`; controller + Kyle judge. Task 4 does not start until pass.

Nova Canvas INPAINTING request body (authoritative shape):
```json
{
  "taskType": "INPAINTING",
  "inPaintingParams": {
    "image": "<base64 source photo>",
    "maskPrompt": "the roof of the house",
    "text": "<prompt>",
    "negativeText": "text, watermark, distorted architecture, altered windows, altered walls, altered sky"
  },
  "imageGenerationConfig": { "numberOfImages": 1, "quality": "standard", "cfgScale": 7 }
}
```
Prompt builder (used by spike AND the generate handler): `"architectural asphalt shingle roof in <Color Name>: <first sentence of the color's description, lowercased, em-dash-free>, photorealistic, keep the rest of the house unchanged"`.

## Task 1: `app/api` workspace — handlers with tests (no real AWS calls)

Files: `app/api/package.json` (`@chq/api`; deps @aws-sdk/client-{s3,dynamodb,bedrock-runtime,ssm} + @aws-sdk/s3-request-presigner; dev esbuild, vitest, aws-sdk-client-mock), `tsconfig.json`, `src/lib/http.ts` (json(), clientIp() from x-forwarded-for first hop), `src/lib/ratelimit.ts`, `src/lib/google.ts`, `src/lib/bedrock.ts` (payload per Task 0 shape + prompt builder), `src/handlers/measure.ts`, `src/handlers/vizUpload.ts`, `src/handlers/vizGenerate.ts`, `test/*.test.ts`, build script `esbuild src/handlers/*.ts --bundle --platform=node --target=node22 --format=esm --out-extension:.js=.mjs --outdir=dist` (one subdir per handler: `dist/measure/index.mjs` etc.).

Contracts:
- `POST /api/measure` `{address}` → `{available:false}` (no key in SSM) | `{found:false, reason}` | `{found:true, outlineSqft:number}` (unrounded float; clamp reject outside (100, 20000) → found:false). Geocode result must have FL state component. 429 JSON on cap.
- `POST /api/visualize/upload` `{contentType}` → `{uploadId, putUrl}` (S3 key `uploads/{uploadId}.{ext}`, 15-min expiry, enforced content-type + 8MB via presigned conditions where supported, else contentType echo).
- `POST /api/visualize/generate` `{uploadId, product, color}` → validates product/color against a bundled copy of the 24 names → cache HeadObject `renders/{uploadId}/{product}/{slug}.png` hit → presigned GET; miss → load upload, invoke Nova Canvas, put render, presigned GET. Errors: `{error:"generation-failed"}` 502, caps 429, unknown upload 404.

Test goldens: 100 m² → 1076.39104167 sqft (toBeCloseTo); FL filter rejects a GA geocode fixture; rate limiter denies at cap+1 (mocked DDB); cache hit performs zero bedrock invocations (mock assert); prompt builder output contains color name, contains no em dash; upload rejects content types other than image/jpeg|png.

Commit: `feat(api): measure and visualizer handlers with tests`

## Task 2: `infra/api` stack + CloudFront /api behavior — APPLY

Files: `infra/api/{providers,main,lambda,apigw,outputs}.tf` (backend key `api/terraform.tfstate`), plus `infra/site/cloudfront.tf` gains the API origin + `/api/*` ordered_cache_behavior (all methods, cache disabled via managed CachingDisabled policy `4135ea2d-6df8-44a3-9df3-4b5a84be39ad`, origin request policy AllViewerExceptHostHeader `b689b0a8-53d0-40ab-baf2-68738e2966ac`).

Resources: S3 bucket (private, PAB, lifecycle 30d on `uploads/` and `renders/`, CORS per Global Constraints), DynamoDB `chq-api` (PK `pk` S, TTL `expiresAt`), 3 Lambdas (nodejs22.x, 512MB; vizGenerate 1024MB timeout 60s, others 15s) from `archive_file` zips of `app/api/dist/<name>/`, env vars (BUCKET, TABLE, MODEL_ID, GOOGLE_KEY_PARAM), per-function roles: measure → SSM GetParameter (that param) + DDB; vizUpload → S3 PutObject presign scope + DDB; vizGenerate → S3 Get/Put/Head on bucket, bedrock:InvokeModel on the model ARN, DDB. HTTP API (apigatewayv2) `chq-api` with the three POST routes at literal `/api/...` paths + lambda permissions. SSM parameter placeholder.

Steps: build `app/api` → init/validate/plan (expect ~25 adds in api stack + 1 change in site stack — review before apply, foreground) → apply both stacks → verify with curls THROUGH CloudFront using the gate cookie: measure returns `{"available":false}` (no key yet), upload returns a putUrl, generate with fake uploadId returns 404. Commit: `feat(infra): api stack (measure + visualizer) and CloudFront /api behavior`

## Task 3: Frontend measurement wiring

Store: add `outlineSource: 'satellite' | 'manual' | null`; `setOutlineFromSatellite(sqft)`. StepHome: on entry with an address and no sq yet, POST /api/measure (8s timeout); loading state "Sizing your roof from satellite imagery..."; `found` → confirmation card "We sized your roof from satellite imagery." + [Looks right, continue] + text link "Prefer to enter your home's footprint? Enter it manually."; any failure/timeout/`available:false` → existing manual input unchanged. Never render numbers. Unit tests for the new store action + a fetch-mocked component test of the three states. Walkthrough unchanged and green (preview has no /api; it must fall back to manual silently — assert no error UI appears). Commit: `feat(web): satellite measurement with manual fallback`

## Task 4 (GATED on Task 0 pass): "See it on your home" visualizer UI

StepColor top section: upload card ("See these colors on your home. Upload a photo of the front of your house.") → browser downscale to ≤ 1568px JPEG q0.85 (canvas) → presigned PUT → generate for the currently selected color → viewer panel (render above the swatch grid, Lightbox on click) → background warm remaining colors of the active line (2 concurrent, sequential queue, abort on unmount) → per-color: selecting a swatch swaps to its render when ready (spinner chip when in flight). Change/remove photo control. Disclaimer line per Global Constraints. Graceful errors ("We couldn't generate this preview."). Store: `uploadId` persisted; renders map in-memory only (regenerate via cache-hit on revisit). Walkthrough: assert the upload card renders on the color step and the flow degrades silently with no API. Screenshots both widths. Commit: `feat(web): AI roof visualizer on the color step`

## Task 5: Ship

Final whole-branch review (most capable model) → fix wave if needed → PR → merge → deploy → live smoke through the gate: measure curl, one REAL generate against a real uploaded test photo (~$0.05), confirm render URL serves; update README + memory; report to Kyle with the GCP-key runbook (project → enable Solar API + Geocoding API → create restricted key → `aws ssm put-parameter --name /chq/google-api-key --type SecureString --value <key> --overwrite --profile chq-comforthomequote`).
