# ComfortHomeQuote Plan 3: Client Preview Release

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the real site — pricing engine v2 (client's progressive bands), the configurator wizard, marketing pages, branded password gate, and auto-deploy — live at https://comforthomequote.com behind the gate.

**Architecture:** See `docs/superpowers/specs/2026-08-18-client-preview-design.md`. Business rules: `docs/client/pricing-rules.md`. Copy: `docs/client/website-copy.md`. UX: `docs/client/ux-spec.md`.

**Tech Stack:** React 18 + Vite + TS + Tailwind v4 + react-router + zustand + motion; @fontsource-variable fonts; Terraform for the gate; GHA OIDC deploy.

## Global Constraints

- **Never render per-SQ rates, band tables, or formulas in the UI.** Customer sees totals, `+$X,XXX` deltas, and "approximately $X/month" only. No cents, ever (`$12,000`, never `$12,000.00`).
- All money display comes from `@chq/pricing` v2 — no arithmetic in components.
- Client anchor prices are golden: IKO 5/10/24/35/50/65/80/100 SQ → 4750/7000/12000/16800/22500/27750/32625/38625; Titan → 5000/7500/13200/18400/25000/31000/36625/43625. Final prices ALWAYS round UP to whole dollars.
- Copy comes from `docs/client/website-copy.md`. Keep the client's voice and facts, but apply Kyle's style rules: **never use em dashes anywhere in user-facing text** (rewrite as two sentences or use a comma), keep text concise and scannable (trim long paragraphs to their point, prefer short lines, no screen should feel like reading), and when polish competes with simplicity, choose simple. Wind-warranty language stays exactly as written (legal); footnote required on pages with warranty/financing claims.
- Design tokens (CSS vars, exact): `--navy-950:#0F1B33; --navy-800:#1D2E52; --blue-600:#2563C9; --blue-500:#3B82E8; --sky-50:#F2F6FC; --amber-400:#F5A623; --ink:#101828`. Fonts: Bricolage Grotesque (display + price, tabular numerals), Public Sans (body), both self-hosted via @fontsource-variable. No external network requests from the page (fonts/images all local).
- Mobile-first: sticky bottom price bar < 768px, persistent top-right price card ≥ 768px. Respect `prefers-reduced-motion`.
- Address-only before the "I'm Ready" step; contact fields only after. Demo-mode notice on info/schedule steps ("Preview build — submissions aren't saved yet").
- Terraform: foreground applies only, plan reviewed before apply, fmt/validate clean. Workflow YAML: least-privilege `permissions:` blocks.
- Conventional commits; `npm test` + `npm run typecheck` green before every commit.

---

### Task 1: Pricing engine v2 (replaces v1 internals)

**Files:**
- Create: `packages/pricing/src/round.ts`, `packages/pricing/src/products.ts`, `packages/pricing/src/price.ts`
- Replace: `packages/pricing/src/types.ts`, `packages/pricing/src/index.ts`
- Delete: `packages/pricing/src/estimate.ts`, `packages/pricing/src/pitch.ts`, `packages/pricing/src/config.ts`, `packages/pricing/src/config/fl-defaults.json`, `packages/pricing/test/estimate.test.ts`, `packages/pricing/test/validation.test.ts`, `packages/pricing/test/pitch.test.ts`, `packages/pricing/test/config.test.ts`, `packages/pricing/test/fixtures.ts`
- Keep: `packages/pricing/src/finance.ts` + `packages/pricing/test/finance.test.ts` (amortization stays for future real-APR display)
- Test: `packages/pricing/test/bands.test.ts`, `packages/pricing/test/helpers.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces (the web app's entire pricing API):
  - Types: `ShingleKey = 'iko-cambridge' | 'tamko-titan-xt'`, `Underlayment = 'synthetic' | 'peel-stick'`, `ProtectionLevel = 'BETTER' | 'BETTER+' | 'BEST' | 'BEST+'`, `ShingleProduct`, `Band`
  - Data: `SHINGLES: Record<ShingleKey, ShingleProduct>` (incl. `colors: string[]`, `tagline`, `highlights: string[]`), `METAL`, `TILE`
  - Functions: `roundUpDollars(x)`, `priceShingle(sq, key)`, `titanUpgrade(sq)`, `peelStickUpgrade(sq)`, `configuredTotal(sq, key, underlayment)`, `guarantee(key, underlayment) → {level, years}`, `estimatedMonthly(total)`, `cashPrice(total)`, `sqFromOutline(outlineSqft)`, `deckingAdjustment(sheets)`, retained `monthlyPayment(principal, aprPct, months)`

- [ ] **Step 1: Write the failing tests**

`packages/pricing/test/bands.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { priceShingle, titanUpgrade, configuredTotal } from '../src/price';

const IKO_ANCHORS: Array<[number, number]> = [
  [5, 4750], [10, 7000], [24, 12000], [35, 16800],
  [50, 22500], [65, 27750], [80, 32625], [100, 38625],
];
const TITAN_ANCHORS: Array<[number, number]> = [
  [5, 5000], [10, 7500], [24, 13200], [35, 18400],
  [50, 25000], [65, 31000], [80, 36625], [100, 43625],
];

describe('client anchor prices (golden, from docs/client/pricing-rules.md)', () => {
  it.each(IKO_ANCHORS)('IKO Cambridge %d SQ = $%d', (sq, price) => {
    expect(priceShingle(sq, 'iko-cambridge')).toBe(price);
  });
  it.each(TITAN_ANCHORS)('Titan XT %d SQ = $%d', (sq, price) => {
    expect(priceShingle(sq, 'tamko-titan-xt')).toBe(price);
  });
});

describe('progressive behavior', () => {
  it('applies the minimum for tiny roofs', () => {
    expect(priceShingle(3, 'iko-cambridge')).toBe(4750);
    expect(priceShingle(0.5, 'tamko-titan-xt')).toBe(5000);
  });
  it('prices fractional measurements exactly, rounding UP at the end', () => {
    // IKO 27.43: 4750 + 5×450 + 14×357.142857 + 3.43×436.363636 = 13496.727… → 13497
    expect(priceShingle(27.43, 'iko-cambridge')).toBe(13497);
    // Titan 27.43: 5000 + 5×500 + 14×407.142857 + 3.43×472.727273 = 14821.454… → 14822
    expect(priceShingle(27.43, 'tamko-titan-xt')).toBe(14822);
  });
  it('computes the Titan upgrade as the difference of rounded totals', () => {
    expect(titanUpgrade(24)).toBe(1200);       // 13200 - 12000 (client example)
    expect(titanUpgrade(27.43)).toBe(1325);    // 14822 - 13497
  });
  it('continues the last band rate beyond 100 SQ', () => {
    expect(priceShingle(110, 'iko-cambridge')).toBe(38625 + 10 * 300);
  });
  it('is monotonic non-decreasing across band edges', () => {
    for (const key of ['iko-cambridge', 'tamko-titan-xt'] as const) {
      let prev = 0;
      for (let sq = 1; sq <= 105; sq += 0.5) {
        const p = priceShingle(sq, key);
        expect(p).toBeGreaterThanOrEqual(prev);
        prev = p;
      }
    }
  });
  it('configuredTotal adds the peel & stick upgrade', () => {
    expect(configuredTotal(24, 'iko-cambridge', 'synthetic')).toBe(12000);
    expect(configuredTotal(24, 'iko-cambridge', 'peel-stick')).toBe(13200); // 12000 + 24×50
  });
  it('rejects out-of-domain sizes', () => {
    for (const bad of [0, -3, Number.NaN, 201]) {
      expect(() => priceShingle(bad, 'iko-cambridge')).toThrow(RangeError);
    }
  });
});
```

`packages/pricing/test/helpers.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import {
  roundUpDollars, peelStickUpgrade, guarantee, estimatedMonthly,
  cashPrice, sqFromOutline, deckingAdjustment,
} from '../src/price';
import { SHINGLES } from '../src/products';

describe('roundUpDollars (client rule 7)', () => {
  it.each([
    [13061.01, 13062], [13061.99, 13062], [13061.0, 13061], [0.01, 1],
  ])('%f → %d', (x, expected) => expect(roundUpDollars(x)).toBe(expected));
});

describe('peel & stick upgrade', () => {
  it('matches the client worked example: 27.43 SQ → $1,372', () => {
    expect(peelStickUpgrade(27.43)).toBe(1372);
  });
  it('24 SQ → $1,200', () => expect(peelStickUpgrade(24)).toBe(1200));
});

describe('guarantee matrix (client rule 10)', () => {
  it.each([
    ['iko-cambridge', 'synthetic', 'BETTER', 5],
    ['iko-cambridge', 'peel-stick', 'BETTER+', 10],
    ['tamko-titan-xt', 'synthetic', 'BEST', 10],
    ['tamko-titan-xt', 'peel-stick', 'BEST+', 15],
  ] as const)('%s + %s = %s / %d years', (s, u, level, years) => {
    expect(guarantee(s, u)).toEqual({ level, years });
  });
});

describe('financing heuristic ($10 per $1,000) and cash', () => {
  it('client example: $17,000 → $170/month', () => expect(estimatedMonthly(17000)).toBe(170));
  it('rounds partial thousands up: $13,497 → $135/month', () => expect(estimatedMonthly(13497)).toBe(135));
  it('cash is 5% off, rounded up: $12,000 → $11,400', () => expect(cashPrice(12000)).toBe(11400));
});

describe('measurement + decking', () => {
  it('client rule: 2,000 sq ft outline → 24 SQ', () => expect(sqFromOutline(2000)).toBe(24));
  it('does not round: 1,910 sq ft → 22.92 SQ', () => expect(sqFromOutline(1910)).toBeCloseTo(22.92, 10));
  it('client example: 9 sheets → $312', () => expect(deckingAdjustment(9)).toBe(312));
  it('5 or fewer sheets → $0', () => expect(deckingAdjustment(5)).toBe(0));
});

describe('product data', () => {
  it('carries the exact client color lists', () => {
    expect(SHINGLES['iko-cambridge'].colors).toHaveLength(10);
    expect(SHINGLES['tamko-titan-xt'].colors).toHaveLength(14);
    expect(SHINGLES['iko-cambridge'].colors).toContain('Dove White');
    expect(SHINGLES['tamko-titan-xt'].colors).toContain('Olde English Pewter');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -w @chq/pricing` — Expected: FAIL, cannot resolve `../src/price` / `../src/products`.

- [ ] **Step 3: Implement**

`packages/pricing/src/round.ts`:
```ts
// Client rule 7: final prices ALWAYS round up to the nearest whole dollar.
// The epsilon keeps exact-dollar floats (e.g. 13061.000000000002) from bumping up.
export function roundUpDollars(x: number): number {
  return Math.ceil(x - 1e-7);
}
```

`packages/pricing/src/types.ts`:
```ts
export type ShingleKey = 'iko-cambridge' | 'tamko-titan-xt';
export type Underlayment = 'synthetic' | 'peel-stick';
export type ProtectionLevel = 'BETTER' | 'BETTER+' | 'BEST' | 'BEST+';

export interface Band {
  upToSq: number;    // band covers (previous upToSq, upToSq]
  ratePerSq: number; // marginal rate for that portion only
}

export interface ShingleProduct {
  key: ShingleKey;
  name: string;
  tier: 'BETTER' | 'BEST';
  tagline: string;
  highlights: string[];
  minimumSq: number;     // roofs at or below this size pay minimumPrice
  minimumPrice: number;
  bands: Band[];         // ascending upToSq, starting above minimumSq
  colors: string[];
  workmanshipYears: Record<Underlayment, number>;
}
```

`packages/pricing/src/products.ts`:
```ts
import type { ShingleKey, ShingleProduct } from './types';

export const SHINGLES: Record<ShingleKey, ShingleProduct> = {
  'iko-cambridge': {
    key: 'iko-cambridge',
    name: 'IKO Cambridge',
    tier: 'BETTER',
    tagline: 'Dependable Performance. Excellent Value.',
    highlights: [
      'Class 3 impact resistance classification',
      '110 MPH Limited Wind Warranty',
      'Up to 130 MPH Limited High-Wind Warranty when installed according to applicable IKO requirements*',
      'Class A fire resistance',
      'Limited Lifetime manufacturer warranty*',
      '10-year Iron Clad Protection period*',
    ],
    minimumSq: 5,
    minimumPrice: 4750,
    bands: [
      { upToSq: 10, ratePerSq: 450 },
      { upToSq: 24, ratePerSq: 357.142857 },
      { upToSq: 35, ratePerSq: 436.363636 },
      { upToSq: 50, ratePerSq: 380 },
      { upToSq: 65, ratePerSq: 350 },
      { upToSq: 80, ratePerSq: 325 },
      { upToSq: 100, ratePerSq: 300 },
    ],
    colors: [
      'Dual Black', 'Dual Grey', 'Dual Brown', 'Weatherwood', 'Charcoal Grey',
      'Beachwood', 'Harvard Slate', 'Earthtone Cedar', 'Driftwood', 'Dove White',
    ],
    workmanshipYears: { synthetic: 5, 'peel-stick': 10 },
  },
  'tamko-titan-xt': {
    key: 'tamko-titan-xt',
    name: 'TAMKO Titan XT',
    tier: 'BEST',
    tagline: 'Enhanced Protection. Premium Performance.',
    highlights: [
      'UL 2218 Class 3 impact resistance',
      '110 MPH standard Limited Wind Warranty',
      'Up to 160 MPH Limited Wind Warranty when installed according to applicable TAMKO high-wind requirements*',
      'Limited Lifetime manufacturer warranty*',
      '10-year Full Start non-prorated warranty period*',
    ],
    minimumSq: 5,
    minimumPrice: 5000,
    bands: [
      { upToSq: 10, ratePerSq: 500 },
      { upToSq: 24, ratePerSq: 407.142857 },
      { upToSq: 35, ratePerSq: 472.727273 },
      { upToSq: 50, ratePerSq: 440 },
      { upToSq: 65, ratePerSq: 400 },
      { upToSq: 80, ratePerSq: 375 },
      { upToSq: 100, ratePerSq: 350 },
    ],
    colors: [
      'Black Walnut', 'Natural Timber', 'Thunderstorm Grey', 'Desert Sand',
      'Glacier White', 'Olde English Pewter', 'Oxford Grey', 'Rustic Black',
      'Rustic Cedar', 'Rustic Hickory', 'Rustic Slate', 'Shadow Grey',
      'Virginia Slate', 'Weathered Wood',
    ],
    workmanshipYears: { synthetic: 10, 'peel-stick': 15 },
  },
};

// Education pages only — NOT configurator-priced (tier cliffs; see docs/client/pricing-rules.md).
export const METAL = {
  name: 'Tri State 26-Gauge Standing Seam',
  tiers: [
    { maxSq: 5, ratePerSq: 1300 },
    { maxSq: 15, ratePerSq: 1200 },
    { maxSq: 25, ratePerSq: 900 },
    { maxSq: 35, ratePerSq: 850 },
    { maxSq: Infinity, ratePerSq: 800 },
  ],
  gauge24UpchargePerSq: 50,
  guaranteeYears: 50,
  manufacturerWarrantyYears: 40,
} as const;

export const TILE = {
  name: 'Eagle Tile',
  ratePerSq: 1300,
  guaranteeYears: 20,
  manufacturerWarranty: 'Lifetime transferable Limited Warranty',
} as const;
```

`packages/pricing/src/price.ts`:
```ts
import type { ProtectionLevel, ShingleKey, Underlayment } from './types';
import { SHINGLES } from './products';
import { roundUpDollars } from './round';

export { roundUpDollars };

export function priceShingle(sq: number, key: ShingleKey): number {
  if (!(sq > 0) || sq > 200) throw new RangeError('sq must be in (0, 200]');
  const p = SHINGLES[key];
  if (sq <= p.minimumSq) return p.minimumPrice;
  let total = p.minimumPrice;
  let prev = p.minimumSq;
  for (const band of p.bands) {
    const portion = Math.min(sq, band.upToSq) - prev;
    if (portion > 0) total += portion * band.ratePerSq;
    prev = band.upToSq;
  }
  const lastBand = p.bands[p.bands.length - 1]!;
  if (sq > prev) total += (sq - prev) * lastBand.ratePerSq;
  return roundUpDollars(total);
}

export function titanUpgrade(sq: number): number {
  return priceShingle(sq, 'tamko-titan-xt') - priceShingle(sq, 'iko-cambridge');
}

export function peelStickUpgrade(sq: number): number {
  if (!(sq > 0) || sq > 200) throw new RangeError('sq must be in (0, 200]');
  return roundUpDollars(sq * 50);
}

export function configuredTotal(sq: number, key: ShingleKey, underlayment: Underlayment): number {
  return priceShingle(sq, key) + (underlayment === 'peel-stick' ? peelStickUpgrade(sq) : 0);
}

export function guarantee(key: ShingleKey, underlayment: Underlayment): { level: ProtectionLevel; years: number } {
  const years = SHINGLES[key].workmanshipYears[underlayment];
  const base = SHINGLES[key].tier;
  const level = (underlayment === 'peel-stick' ? `${base}+` : base) as ProtectionLevel;
  return { level, years };
}

// Client rule of thumb: $10/month for every $1,000 of project cost.
export function estimatedMonthly(total: number): number {
  if (!(total > 0)) throw new RangeError('total must be > 0');
  return Math.ceil(total / 100);
}

export function cashPrice(total: number): number {
  if (!(total > 0)) throw new RangeError('total must be > 0');
  return roundUpDollars(total * 0.95);
}

// Client measuring rule: raw outline × 1.2 (10% waste + 10% pitch), NO rounding.
export function sqFromOutline(outlineSqft: number): number {
  if (!(outlineSqft > 0) || outlineSqft > 20000) throw new RangeError('outlineSqft must be in (0, 20000]');
  return (outlineSqft * 1.2) / 100;
}

export function deckingAdjustment(sheets: number): number {
  if (sheets < 0 || !Number.isInteger(sheets)) throw new RangeError('sheets must be a non-negative integer');
  return Math.max(sheets - 5, 0) * 78;
}
```

`packages/pricing/src/index.ts`:
```ts
export * from './types';
export { SHINGLES, METAL, TILE } from './products';
export {
  roundUpDollars, priceShingle, titanUpgrade, peelStickUpgrade,
  configuredTotal, guarantee, estimatedMonthly, cashPrice,
  sqFromOutline, deckingAdjustment,
} from './price';
export { monthlyPayment } from './finance';
```

Delete the v1 files listed above.

- [ ] **Step 4: Run full suite + typecheck**

Run: `npm test -w @chq/pricing && npm run typecheck -w @chq/pricing`
Expected: PASS — 3 test files (bands, helpers, finance), typecheck clean. If ANY anchor test fails, the bug is in the implementation — never adjust anchor values.

- [ ] **Step 5: Update README pricing section**

Replace the `## packages/pricing` section of `README.md` with:
```markdown
## packages/pricing

Deterministic pricing engine implementing the client's progressive band model
(see docs/client/pricing-rules.md — INTERNAL; never render per-SQ rates in UI).

    import { configuredTotal, guarantee, estimatedMonthly } from '@chq/pricing';
    const total = configuredTotal(27.43, 'tamko-titan-xt', 'peel-stick'); // whole dollars
    const monthly = estimatedMonthly(total); // "$X/month (approximately)"

Anchor prices from the client are locked in as golden tests.
```

- [ ] **Step 6: Commit**

```bash
git add packages/pricing README.md
git commit -m "feat(pricing)!: v2 progressive band engine per client business rules"
```

---

### Task 2: Web app scaffold + brand foundation

**Files:**
- Create: `app/web/` (Vite react-ts app: `package.json` name `@chq/web`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/index.css`, `src/components/Header.tsx`, `src/components/Footer.tsx`), `app/web/public/logo.webp`, `app/web/public/favicon.png`, `app/web/public/robots.txt` (`User-agent: *` / `Disallow: /`), `app/web/public/metal/flyer-1.jpg` `flyer-2.jpg` `flyer-3.jpg`

**Interfaces:**
- Consumes: monorepo root (workspaces already include `app/*`), `@chq/pricing` (add as dependency `"@chq/pricing": "*"`)
- Produces: buildable app shell with router (`/`, `/build`, `/next`, `/about`, `/metal` routes rendering placeholder components), design tokens, fonts, header (logo + nav) / footer (tagline + footnote), asset pipeline. Later tasks fill the routes.

Key requirements:
- Dependencies: `react-router-dom`, `zustand`, `motion`, `@fontsource-variable/bricolage-grotesque`, `@fontsource-variable/public-sans`, `tailwindcss` + `@tailwindcss/vite` (v4). Dev: `@testing-library/react`, `jsdom`.
- `src/index.css`: Tailwind v4 `@import "tailwindcss";` + `@theme` block mapping the Global Constraints tokens (`--color-navy-950` etc.) + font-family tokens + `font-variant-numeric: tabular-nums` utility class for prices.
- Asset prep (use macOS `sips` or equivalent): `logo/20CF9D20-*.png` → `app/web/public/logo.webp` (~512px wide) + `favicon.png` (64px, cropped to the roofline mark region is fine — a square crop of the full logo is acceptable); `pics/IMG_0009/0010/0011.jpeg` → `app/web/public/metal/flyer-{1,2,3}.jpg` resized to 1600px wide, quality ~80.
- `index.html`: title "Comfort Home Quote", meta description from the tagline, favicon, `lang="en"`, theme-color `#0F1B33`.
- Scripts: `dev`, `build` (`tsc -b && vite build` or `vite build` + separate typecheck), `typecheck`, `test` (vitest, `--passWithNoTests` until Task 3 adds tests).
- Header: logo image + wordmark nav (Build My Roof → `/build`, Roofing Options → `/metal`, About → `/about`); mobile: logo + hamburger-less minimal nav (these 3 links fit). Footer: tagline, "Serving Florida homeowners", the required footnote (small, muted).

Verification: `npm install` (workspace), `npm run build -w @chq/web` succeeds, `npm run typecheck -w @chq/web` clean, `ls app/web/dist/index.html`, assets exist and each is < 400KB. Commit `feat(web): app scaffold, brand tokens, fonts, assets`.

---

### Task 3: Configuration store + live price components

**Files:**
- Create: `app/web/src/state/build.ts` (zustand store), `app/web/src/components/PriceHero.tsx` (desktop card + mobile sticky bar in one module), `app/web/src/lib/format.ts`
- Test: `app/web/src/state/build.test.ts`

**Interfaces:**
- Consumes: `@chq/pricing` v2 API (Task 1)
- Produces: `useBuild()` store consumed by every screen:
```ts
interface BuildState {
  address: string | null;
  outlineSqft: number | null;
  sq: number | null;                 // sqFromOutline(outlineSqft), set together
  shingle: ShingleKey | null;
  color: string | null;
  underlayment: Underlayment;        // default 'synthetic'
  dripEdge: 'White' | 'Black' | 'Brown' | null;
  accepted: boolean;                 // set by "I'm Ready to Move Forward"
  contact: { name: string; phone: string; email: string; billing: string; method: string } | null;
  visit: { date: string; window: 'Morning' | 'Afternoon' | 'No Preference' } | null;
  // actions
  setAddress(a: string): void; setOutline(sqft: number): void;
  setShingle(k: ShingleKey): void; setColor(c: string): void;
  setUnderlayment(u: Underlayment): void; setDripEdge(c: DripEdge): void;
  accept(): void; setContact(c: Contact): void; setVisit(v: Visit): void; reset(): void;
}
// Derived selectors (exported functions over the state, unit-tested):
selectTotal(s): number | null           // configuredTotal when sq+shingle set
selectMonthly(s): number | null
selectUpgradeDelta(s): number | null    // titanUpgrade(sq) when sq set
selectPeelStickDelta(s): number | null
selectGuarantee(s): {level, years} | null
selectCash(s): number | null
```
- Store persists via zustand `persist` to localStorage key `chq-build-v1`. Changing shingle resets color (color lists differ).
- `format.ts`: `usd(n)` → `$12,000` (Intl.NumberFormat en-US, maximumFractionDigits 0 — never cents), `perMonth(n)` → `$135/month`.
- `PriceHero`: hidden until `selectTotal` is non-null. Desktop (≥768px): fixed top-right card — "YOUR ROOF", big tabular total, "or approximately $X/month*", guarantee chip when set. Mobile: fixed bottom bar — total + monthly + [Review] link. Price changes animate: count-up over ~400ms + subtle scale pulse (motion; skip animation under `prefers-reduced-motion`).

Unit tests (vitest + jsdom): golden flow — setOutline(2286) → sq ≈ 27.432; then with 27.43-equivalent asserts using engine functions (compare selectors' output to direct engine calls, plus one absolute golden: outline 2000 + IKO + peel-stick → total 13200, monthly 132, guarantee BETTER+/10yr). Shingle switch resets color. Persistence round-trip (serialize/deserialize).

Verification: `npm test -w @chq/web` green, typecheck, build. Commit `feat(web): build store, selectors, animated price hero`.

---

### Task 4: Configurator wizard (`/build`) — screens address → review

**Files:**
- Create: `app/web/src/routes/Build.tsx` (step shell: progress rail, step routing via `#hash`, back nav), `app/web/src/routes/build/StepAddress.tsx`, `StepHome.tsx`, `StepShingle.tsx`, `StepColor.tsx`, `StepUnderlayment.tsx`, `StepProtection.tsx`, `StepIncluded.tsx`, `StepFinishing.tsx`, `StepReview.tsx`, `app/web/src/content/included.ts` (12 tiles from `docs/client/website-copy.md`), `app/web/src/content/swatches.ts` (color-name → approximate hex map for both product lines)

**Interfaces:**
- Consumes: `useBuild()` + selectors (Task 3), copy from `docs/client/website-copy.md`, flow rules from `docs/client/ux-spec.md`
- Produces: complete pre-acceptance flow ending in Review with [EDIT MY ROOF] and [I'M READY TO MOVE FORWARD] → `accept()` → navigate `/next`.

Screen requirements (all copy from the copy doc; all constraints from Global Constraints):
- **Address:** single input + [BUILD MY ROOF]. No contact fields. Plain text input this release (no autocomplete API yet).
- **Home size:** "Confirm your home's size" — footprint sq ft numeric input, helper "You can find your home's footprint on your county property appraiser's site." Shows derived roof size ONLY as friendly text ("Your roof comes out to about X roofing squares" is NOT shown — remember: no internal units. Instead show: "Got it — we've sized your roof."). Advances only with valid input (500–15,000 sq ft).
- **Shingle:** two cards per UX spec — BETTER shows full total; BEST emphasizes `+$[titanUpgrade]` and `+$/month` delta. [LEARN MORE] opens a drawer with the highlights list + footnote. Selection state = blue fill + check.
- **Color:** swatch grid for the selected product (approximate hexes from `swatches.ts`, label + small "Digital approximation — final color from manufacturer samples" note). Selection highlight per spec.
- **Underlayment:** STANDARD (INCLUDED badge, amber) vs PREMIUM (`+$[peelStickUpgrade]`, `+5 YEARS` guarantee chip). Never any per-SQ figure.
- **Protection:** confirmation moment — "YOUR ROOF IS [LEVEL]" + equation graphic (shingle + underlayment = X-year guarantee), animated in. [CONTINUE].
- **Included:** 12-tile responsive grid (icon + title + 1-2 sentences + INCLUDED chip); tiles with longer copy (Decking, Permits, Wind Mitigation) expand. Inline SVG line icons (simple, consistent stroke) — no icon library dependency.
- **Finishing:** drip edge White/Black/Brown radio cards.
- **Review:** vehicle-config style summary (system, color, underlayment, drip edge, protection level, guarantee, condensed included checklist), price + monthly + cash option line ("Pay cash: $X — 5% discount"), decking disclosure line (first 5 sheets included; $78/sheet after — from copy doc tile 2), then CTAs. [I'M READY TO MOVE FORWARD] is visually the strongest element on the page.
- Steps gate progression (can't reach color without shingle, etc.); back navigation preserves everything; hash routing so browser Back works.

Verification: build + typecheck + store tests still green. Playwright (use the venv pattern or npx playwright with system chromium already cached): script `app/web/scripts/screenshot.mjs` or python equivalent that walks the happy path (2,000 sq ft, Titan, Rustic Black, peel & stick, black drip edge) asserting the review page shows **$14,400** ( = 13,200 + 1,200) and **$144/month**, capturing screenshots of every step at 390×844 and 1280×800 into `.superpowers/sdd/screens/`. Commit `feat(web): configurator wizard screens address through review`.

*(Hand-check for that assertion: Titan 24 SQ = 13,200; peel & stick 24×50 = 1,200; total 14,400; monthly ceil(14400/100)=144.)*

---

### Task 5: Landing page, About, post-acceptance demo flow (`/next`)

**Files:**
- Create: `app/web/src/routes/Landing.tsx`, `app/web/src/routes/About.tsx`, `app/web/src/routes/Next.tsx` + `app/web/src/routes/next/StepPartner.tsx`, `StepInfo.tsx`, `StepSchedule.tsx`, `StepConfirm.tsx`

**Interfaces:**
- Consumes: store (accepted config), copy doc sections (About, partner, info, visit, confirmation)
- Produces: `/` hero (navy, logo motif, tagline, one CTA → `/build`, three-step how-it-works: Address → Build → Your Price, "Your information stays yours" strip, links to About/Metal), `/about` (client About copy, editorial layout), `/next` guarded (redirects to `/build` unless `accepted`): Partner → Info form → Schedule (date input ≥ 7 days out + Morning/Afternoon/No Preference) → Confirmation summary. Info + Schedule show the demo notice ("Preview build — submissions aren't saved yet"); data stored in the local store only.

Verification: build + typecheck; extend the Playwright script through `/next` to the confirmation screen (screenshots both widths). Commit `feat(web): landing, about, post-acceptance demo flow`.

---

### Task 6: Metal & Tile education page

**Files:**
- Create: `app/web/src/routes/Metal.tsx`, `app/web/src/components/Lightbox.tsx`

**Interfaces:**
- Consumes: `METAL`/`TILE` data (Task 1), flyers `public/metal/flyer-{1,2,3}.jpg`, warranty copy from `docs/client/pricing-rules.md`
- Produces: `/metal` — hero ("Standing Seam Metal. Built to Last."), benefits section (durability, wind, energy, low maintenance — from the flyer content, rewritten as site copy in client voice), the three flyers as a click-to-zoom gallery (Lightbox: full-screen overlay, esc/tap to close), warranty/guarantee block (50-yr guarantee, 40-yr Tri State warranty; Eagle Tile section: 20-yr guarantee, lifetime limited warranty), **"starting at" framing only** (e.g. "Standing seam projects start around $800/SQ for larger roofs — request a custom quote"): NO calculator, per the spec's metal-pricing open question. CTA: "Request a custom metal quote" → mailto link (comforthomequote placeholder) with the demo notice.

Verification: build + typecheck; Playwright screenshots of `/metal` both widths (lightbox open + closed). Commit `feat(web): metal and tile education page`.

---

### Task 7: Password gate + deploy pipeline + ship

**Files:**
- Create: `app/web/public/gate.html` (fully self-contained: inline CSS/JS, small inline base64 logo), `infra/site/gate-function.js`, `.github/workflows/deploy-web.yml`
- Modify: `infra/site/cloudfront.tf` (function resource + association)

**Interfaces:**
- Consumes: site stack (Plan 2), `chq-github-deploy` role, distribution E2ORSMTHXNTZ5Y
- Produces: gated live site at https://comforthomequote.com, auto-deploying on merge to main.

`infra/site/gate-function.js`:
```js
// CloudFront Function (viewer-request): preview password gate.
// Cookie must equal sha256("ComfortRoof2026") hex. Rotate: change HASH, terraform apply.
var HASH = 'REPLACE_WITH_SHA256_HEX'; // compute in Step 2

function handler(event) {
  var request = event.request;
  var uri = request.uri;
  if (uri === '/gate.html' || uri === '/robots.txt' || uri === '/favicon.png') {
    return request;
  }
  var cookies = request.cookies;
  if (cookies && cookies.chq_preview && cookies.chq_preview.value === HASH) {
    return request;
  }
  return {
    statusCode: 302,
    statusDescription: 'Found',
    headers: { location: { value: '/gate.html' } },
  };
}
```

Terraform addition to `infra/site/cloudfront.tf`:
```hcl
resource "aws_cloudfront_function" "gate" {
  name    = "chq-preview-gate"
  runtime = "cloudfront-js-2.0"
  publish = true
  code    = file("${path.module}/gate-function.js")
}
```
and inside `default_cache_behavior`:
```hcl
    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.gate.arn
    }
```

`gate.html`: navy full-screen, centered logo + "Preview access" heading + tagline + single password input + button. JS: `crypto.subtle.digest('SHA-256', ...)` → hex; compare against the same HASH constant; on match set `document.cookie = 'chq_preview=' + hex + '; Max-Age=2592000; Path=/; Secure; SameSite=Lax'` then `location.replace('/')`; on mismatch shake the input + "That's not it — check with Kyle or Dylan." No password or plaintext hint in source (hash only).

Steps:
1. Compute the hash: `printf 'ComfortRoof2026' | shasum -a 256` — substitute into BOTH gate-function.js and gate.html.
2. `terraform fmt/validate/plan` in infra/site — expect 1 add (function) + 1 change in-place (distribution association), 0 destroy. FOREGROUND apply with long timeout (distribution update takes minutes).
3. Verify gate: `curl -sI https://comforthomequote.com` → 302 with `location: /gate.html`; `curl -sI https://comforthomequote.com/gate.html` → 200; `curl -sI -H "Cookie: chq_preview=<HASH>" https://comforthomequote.com` → 200.
4. Write `.github/workflows/deploy-web.yml`:
```yaml
name: deploy-web

permissions:
  id-token: write
  contents: read

on:
  push:
    branches: [main]

concurrency:
  group: deploy-web
  cancel-in-progress: false

jobs:
  deploy:
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
      - run: npm run build -w @chq/web
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::984950935097:role/chq-github-deploy
          aws-region: us-east-1
      - run: aws s3 sync app/web/dist s3://chq-site-984950935097 --delete
      - run: aws cloudfront create-invalidation --distribution-id E2ORSMTHXNTZ5Y --paths "/*"
```
5. Commit all (`feat(ship): preview password gate and auto-deploy pipeline`), push branch. The deploy workflow will NOT run from the branch (main-only + role trust is main-only) — expected.
6. After the whole-plan review and PR merge (controller does the merge), the deploy fires from main: watch it (`gh run watch`), then verify live: gate 302 → enter password path works (curl with cookie → 200 and body contains "Comfort Home Quote"), `/robots.txt` → 200 `Disallow: /`.

---

## Execution notes (controller)

- UI implementers (Tasks 2, 4, 5, 6) receive the frontend-design direction from the spec's Design Language section in their dispatch and MUST read `docs/client/website-copy.md` + `docs/client/ux-spec.md`. Sonnet tier for UI tasks; haiku only for Task 1 (fully-specified transcription).
- The Playwright screenshot sets in `.superpowers/sdd/screens/` are review artifacts: task reviewers of UI tasks read them (Read tool renders images) in addition to the diff.
- Final whole-branch review (most capable model) before the PR; controller merges; deploy fires from main; controller verifies live gate + site, then reports to Kyle with the password.
