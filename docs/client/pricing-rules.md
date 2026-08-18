# Client Pricing & Business Rules (Dylan Nadeau, Aug 2026 emails)

**INTERNAL — never display these calculations, per-SQ rates, tiers, or formulas to the homeowner.** The homeowner sees only: total project price, estimated monthly payment, and upgrade deltas (`+$X,XXX`).

## Measurement

- Use the exact measurement from the measurement provider when available (e.g. `27.43 SQ`). Never round the measurement before pricing.
- Manual rule (until a provider is wired): raw roof outline area × **1.2** (10% waste + 10% pitch). 2,000 sq ft outline → 2,400 sq ft → 24 SQ.

## Shingles — progressive band pricing (marginal, like tax brackets)

Rates apply only to the portion of the roof within each band. Fractional SQ supported end-to-end. **Final prices always round UP to the nearest whole dollar** ($13,061.01 → $13,062; $13,061.00 → $13,061). Never display cents.

### IKO Cambridge (BETTER) — minimum $4,750 for ≤ 5 SQ

| Roof portion | Incremental rate |
|---|---:|
| 0–5 SQ | $4,750 minimum |
| SQ 6–10 | $450/SQ |
| SQ 11–24 | $357.142857/SQ |
| SQ 25–35 | $436.363636/SQ |
| SQ 36–50 | $380/SQ |
| SQ 51–65 | $350/SQ |
| SQ 66–80 | $325/SQ |
| SQ 81–100 | $300/SQ |

Anchors (MUST hold exactly): 5→$4,750 · 10→$7,000 · 24→$12,000 · 35→$16,800 · 50→$22,500 · 65→$27,750 · 80→$32,625 · 100→$38,625

### TAMKO Titan XT (BEST) — minimum $5,000 for ≤ 5 SQ

| Roof portion | Incremental rate |
|---|---:|
| 0–5 SQ | $5,000 minimum |
| SQ 6–10 | $500/SQ |
| SQ 11–24 | $407.142857/SQ |
| SQ 25–35 | $472.727273/SQ |
| SQ 36–50 | $440/SQ |
| SQ 51–65 | $400/SQ |
| SQ 66–80 | $375/SQ |
| SQ 81–100 | $350/SQ |

Anchors: 5→$5,000 · 10→$7,500 · 24→$13,200 · 35→$18,400 · 50→$25,000 · 65→$31,000 · 80→$36,625 · 100→$43,625

**Worked example (IKO, 24 SQ):** $4,750 + 5×$450 + 14×$357.142857 = $12,000.

**Titan upgrade display:** compute both systems for the exact measurement; customer sees only the difference: `Upgrade to Titan XT +$1,200`.

## Underlayment

- Synthetic: included, $0.
- Full Peel & Stick: internal `exact SQ × $50`, round up (27.43 × 50 = 1,371.50 → **$1,372**). Adds **+5 years** workmanship guarantee. Never show "$50/SQ".

## Workmanship guarantee matrix

| Shingle | Underlayment | Guarantee |
|---|---|---:|
| IKO Cambridge | Synthetic | 5 years (BETTER) |
| IKO Cambridge | Peel & Stick | 10 years (BETTER+) |
| Titan XT | Synthetic | 10 years (BEST) |
| Titan XT | Peel & Stick | 15 years (BEST+) |

Manufacturer warranties stay separate from workmanship guarantee. Wind language: "Up to 130 MPH Limited High-Wind Warranty when installed according to applicable IKO requirements*" / "Up to 160 MPH Limited Wind Warranty when installed according to applicable TAMKO high-wind requirements*". Never say "130/160 MPH rated".

## Decking

First 5 sheets included; `MAX(sheets − 5, 0) × $78` as a potential post-tear-off adjustment (disclose before acceptance; hidden conditions can't be known online).

## Financing & cash

- Finance: rule of thumb **$10/month per $1,000** ($17,000 → ~$170/mo). $0 down, no prepayment penalty, first payment ≥1 month after completion, 6.99% lowest APR. Always "approximately", with lender disclosure.
- Cash: **5% discount** — half upfront, half on completion.

## Shingle colors

- IKO Cambridge: Dual Black, Dual Grey, Dual Brown, Weatherwood, Charcoal Grey, Beachwood, Harvard Slate, Earthtone Cedar, Driftwood, Dove White.
- Titan XT: Black Walnut, Natural Timber, Thunderstorm Grey, Desert Sand, Glacier White, Olde English Pewter, Oxford Grey, Rustic Black, Rustic Cedar, Rustic Hickory, Rustic Slate, Shadow Grey, Virginia Slate, Weathered Wood.

## Metal (education page only for now — see open question)

Tri State 26-gauge galvalume standing seam. Tier pricing by roof size (flat per-SQ by size class, NOT progressive): 0–5 SQ $1,300/SQ · 6–15 $1,200/SQ · 16–25 $900/SQ · 26–35 $850/SQ · 36+ $800/SQ. 24-gauge upgrade +$50/SQ. Ultra-high-temp self-adhered ice & water shield underlayment. 50-year labor+material guarantee (transferable once); Tri State 40-year corrosion/paint warranty.

> **OPEN QUESTION for Dylan:** flat tiering creates price cliffs (15 SQ × $1,200 = $18,000 but 16 SQ × $900 = $14,400 — bigger roof, cheaper price). Needs progressive bands like shingles before metal goes in the configurator.

## Tile

Eagle Tile $1,300/SQ. Same UHT underlayment. 20-year labor+material guarantee (transferable once); Eagle lifetime transferable limited warranty. Least popular — education page only.

## Data collection rule (fundamental)

Before "I'm Ready to Move Forward": property address ONLY. No name/phone/email. After: full name, phone, email, property address, billing address, preferred contact method, pre-installation appointment.

## Future (admin-driven pricing)

Pricing must not be hard-coded into frontend components long-term; bands/products/counties/contractors become backend-configurable. County → one assigned contractor partner.
