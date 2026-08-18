# ComfortHomeQuote — Client Preview Release Design

**Date:** 2026-08-18 · **Status:** Approved (Kyle: password gate = branded page, password ComfortRoof2026, metal/tile education pages in, subagent execution)
**Sources:** `docs/client/pricing-rules.md`, `docs/client/website-copy.md`, `docs/client/ux-spec.md` (Dylan's vision — authoritative for pricing math and copy voice). **Architecture and UX decisions are ours** (Kyle's direction, 2026-08-18); deviations from the client spec are listed below and are deliberate.

## Goal

Ship the real ComfortHomeQuote site — configurator + marketing pages — to https://comforthomequote.com behind a branded password gate, auto-deploying on every merge so Dylan watches progress live. Replaces the placeholder page.

## What we adopt from the client spec

- Progressive band pricing with his exact rates/minimums/anchors; totals-and-deltas-only display (no per-SQ/no line-item rates); round-up-to-dollar; exact fractional SQ.
- Better/Best two-product shingle model, underlayment upgrade, guarantee matrix, drip-edge finishing, 12 included tiles, $10-per-$1,000 monthly heuristic (with disclosures), 5% cash option, decking adjustment disclosure.
- Address-only before "I'm Ready"; contact info only after. Persistent animated price (desktop card / mobile sticky bar). His copy verbatim (light typographic cleanup only).

## Our deviations (deliberate)

1. **Single-page wizard, not 13 page loads.** One `/build` route with step state (hash-addressable, localStorage-persisted). His own mobile rules (no refresh, fast transitions, saved config, back nav) demand it.
2. **Interim measurement.** No measurement provider yet. Screen 2 becomes "Confirm your home's size": footprint sq ft input (helper text: find it on your county property appraiser) → SQ = footprint × 1.2 / 100 (his own rule). Copy says "Based on your home's footprint, here's your measured roof" — honest, no fake "we measured" claim. Swaps to a provider (Solar API/Roofr) in a later plan without UX change.
3. **Metal & Tile: education pages only.** His metal tiering has price cliffs (15 SQ = $18,000 vs 16 SQ = $14,400) — flagged back to him in `pricing-rules.md`; configurator stays shingle-only until he defines progressive metal bands. Pages use his three flyers + warranty copy + "request a custom metal quote" CTA.
4. **Screens 10–13 are demo-mode** this release: fully built UI, config stored locally, no backend persistence (API plan lands next). A "Preview build — submissions aren't saved yet" notice shows on the info/schedule steps so Dylan isn't misled.
5. **Transparency framing preserved:** we still show *scope* transparency (everything included, guarantee logic, decking terms) — just not unit economics, per his rule.

## Design language (frontend-design direction)

**Premium-trust navy.** The price is the hero.

- **Palette (CSS vars):** `--navy-950 #0F1B33`, `--navy-800 #1D2E52` (logo navy), `--blue-600 #2563C9` (logo blue, selection + primary CTA), `--blue-500 #3B82E8` hover, `--sky-50 #F2F6FC` light surfaces, white cards, `--amber-400 #F5A623` reserved for INCLUDED badges/guarantee moments, `--ink #101828` body on light. Dark navy hero/gate; light configurator body; never purple, never gradients-on-white clichés.
- **Type:** Bricolage Grotesque (variable) display/headings/price; Public Sans (variable) body. Self-hosted via @fontsource — no external font requests. Price uses tabular numerals, large optical weight.
- **Motion:** Motion (framer) — price ticks with a count animation + subtle scale pulse on change; staggered card reveals per step; step transitions slide (mobile) / fade-lift (desktop). Respect `prefers-reduced-motion`.
- **Layout:** generous negative space on light sections; the roofline arc from the logo echoed as a section-divider SVG motif; selection cards with strong borders (2px navy) that flip to blue fill + check on selection; INCLUDED tiles as a dense responsive grid with line icons.
- **Logo:** `logo/*.png` optimized (webp + trimmed) for header + gate + favicon.

## Architecture

- `app/web`: React 18 + Vite + TypeScript + Tailwind CSS v4 + react-router + zustand (persist) + motion. Routes: `/` (landing), `/build` (wizard: address → home-size → shingle → color → underlayment → protection → included → finishing → review), `/next` (partner → info → schedule → confirmation, demo mode), `/about`, `/metal`.
- `packages/pricing` v2 (**replaces v1 internals**): progressive band engine per client rules. Public API: `SHINGLES` (product data incl. colors), `priceShingle(sq, productKey)`, `titanUpgrade(sq)`, `peelStickUpgrade(sq)`, `guarantee(shingle, underlayment) → {level, years}`, `estimatedMonthly(total)`, `cashPrice(total)`, `sqFromOutline(outlineSqft)`, `deckingAdjustment(sheets)`, `roundUpDollars(x)`, `METAL_TIERS`/`TILE` (data only), plus retained `monthlyPayment` (amortization, 6.99% APR context). v1 line-item model (computeEstimate/fl-defaults/pitch) is deleted — superseded by client rules. Client anchors are the golden tests.
- **Password gate:** CloudFront Function (viewer-request) — allows `/gate.html` + gate assets; otherwise requires cookie `chq_preview=<sha256(password)>`; else 302 → `/gate.html`. Gate page: branded navy, logo, single input; SubtleCrypto sha256 → cookie (Max-Age 30d) → redirect. Password `ComfortRoof2026` (hash constant in function; rotate by redeploying TF). Plus `robots.txt` disallow-all during preview.
- **Deploy:** `.github/workflows/deploy-web.yml` on push to main: build → OIDC-assume `chq-github-deploy` → `aws s3 sync app/web/dist → chq-site-984950935097 --delete` → CloudFront invalidation `/*`. Every merge = Dylan sees it (with the gate password).

## Out of scope (next plans)

Real measurement provider; quotes/leads API + DynamoDB persistence; county→contractor mapping; scheduling backend; admin pricing dashboard; metal/tile in configurator; real shingle color imagery (solid swatches this release, flagged); "view on my home" rendering.

## Costs

No new fixed costs: CloudFront Function free tier, deploys free (public repo), everything else already running (~$0.60/mo).
