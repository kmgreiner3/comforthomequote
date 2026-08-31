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

## Underlayment (feedback round 8: peel & stick is now standard, synthetic discontinued)

- Full Peel & Stick is standard on every quote, no opt-in and no separate line item. Internal `exact SQ × $50`, round up (27.43 × 50 = 1,371.50 → **$1,372**), baked directly into every configured total. Never show "$50/SQ", and never show this as a separate underlayment choice -- the homeowner-facing copy is just "Peel and stick underlayment: Included".
- Synthetic underlayment is discontinued. We no longer offer it.

## Solar panel removal and reinstall (feedback round 8, new)

- Asked as a property question once the roof outline is confirmed: does the home have solar panels, and if so, how many (1-60)?
- $200 per panel, covering removal by a licensed solar contractor before the project and reinstall after. This is a countable, homeowner-entered unit (not an internal per-SQ rate), so "$200 per panel" IS authorized to display at that question.
- 0 panels (explicitly answered "No") costs $0 and is not shown as a line item on Review. A non-zero count shows as "Solar panel removal and reinstall (N panels): +$X".

## Workmanship guarantee (feedback round 8: keyed on shingle alone)

Peel & stick is standard for everyone now, so it no longer changes the guarantee. Guarantee is just the shingle's own workmanship years:

| Shingle | Guarantee |
|---|---:|
| IKO Cambridge | 5 years (BETTER) |
| Titan XT | 10 years (BEST) |

Manufacturer warranties stay separate from workmanship guarantee. Wind language: "Up to 130 MPH Limited High-Wind Warranty when installed according to applicable IKO requirements*" / "Up to 160 MPH Limited Wind Warranty when installed according to applicable TAMKO high-wind requirements*". Never say "130/160 MPH rated". TAMKO's Limited Lifetime manufacturer warranty applies to single-family residences only; the footnote must carry that qualifier wherever TAMKO's warranty is mentioned.

## Decking

First 5 sheets included; `MAX(sheets − 5, 0) × $78` as a potential post-tear-off adjustment (disclose before acceptance; hidden conditions can't be known online).

## Financing & cash

- Finance: rule of thumb **$10/month per $1,000** ($17,000 → ~$170/mo). $0 down, no prepayment penalty, first payment ≥1 month after completion, 6.99% lowest APR. Always "approximately", with lender disclosure.
- Cash: **5% discount**. Pay schedule wording (feedback round 8): "Pay cash: $X (5% discount)" as its own line, then "Pay schedule: 50% on signing, 50% on completion" as a second line — kept separate rather than run together.

## Shingle colors

- IKO Cambridge: Dual Black, Dual Grey, Dual Brown, Weatherwood, Charcoal Grey, Beachwood, Harvard Slate, Earthtone Cedar, Driftwood, Dove White.
- Titan XT: Black Walnut, Natural Timber, Thunderstorm Grey, Desert Sand, Glacier White, Olde English Pewter, Oxford Grey, Rustic Black, Rustic Cedar, Rustic Hickory, Rustic Slate, Shadow Grey, Virginia Slate, Weathered Wood.

## Metal (education page only for now — see open question)

Tri State 26-gauge galvalume standing seam. Tier pricing by roof size (flat per-SQ by size class, NOT progressive): 0–5 SQ $1,300/SQ · 6–15 $1,200/SQ · 16–25 $900/SQ · 26–35 $850/SQ · 36+ $800/SQ. 24-gauge upgrade +$50/SQ. Ultra-high-temp self-adhered ice & water shield underlayment. 50-year labor+material guarantee (transferable once); Tri State 40-year corrosion/paint warranty.

> **OPEN QUESTION for Dylan:** flat tiering creates price cliffs (15 SQ × $1,200 = $18,000 but 16 SQ × $900 = $14,400 — bigger roof, cheaper price). Needs progressive bands like shingles before metal goes in the configurator.

## Tile

Eagle Tile $1,300/SQ. Same UHT underlayment. 20-year labor+material guarantee (transferable once); Eagle lifetime transferable limited warranty. Least popular — education page only.

## Data collection rule (fundamental)

Before "I'm Ready to Move Forward": property address ONLY. No name/phone/email. After: full name, phone, email, property address, billing address (or "Same as the address where work is being done", feedback round 8), preferred contact method, pre-installation appointment within 7 days (feedback round 8: tomorrow through today+7 inclusive; today itself is not offered).

## Future (admin-driven pricing)

Pricing must not be hard-coded into frontend components long-term; bands/products/counties/contractors become backend-configurable. County → one assigned contractor partner.

## Pending (Dylan's Aug 30 2026 Sunday email)

Dylan's Sunday email listed additional property questions to ask alongside solar (beyond just panel count) for a future round. Not yet scoped or priced -- tracked here as pending, not implemented. See `app/web/src/content/propertyQuestions.ts`'s own note for where they'll plug in once ready.
