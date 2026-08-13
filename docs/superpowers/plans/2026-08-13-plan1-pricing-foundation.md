# ComfortHomeQuote Plan 1: Monorepo Foundation + Pricing Engine

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the npm-workspaces monorepo and build `@chq/pricing` — the deterministic, versioned, fully unit-tested estimate engine every other component consumes.

**Architecture:** Pure TypeScript package with zero runtime dependencies. `(RoofInput, Selections, PricingConfig) → Estimate` with transparent line items. Config is versioned JSON in-repo; all percentage values are integer percents so money math is float-safe (integer multiply, divide by 100, round once).

**Tech Stack:** Node ≥20 (target 22), npm workspaces, TypeScript ^5, Vitest ^3. No runtime deps in this package.

**Spec:** `docs/superpowers/specs/2026-08-13-comforthomequote-phase1-design.md`

## Global Constraints

- Package name: `@chq/pricing` (chq- prefix convention).
- Zero runtime dependencies in `packages/pricing`.
- All config percentages are **integer percents** (e.g. `marginPct: 30`), never decimals.
- Money: whole dollars in line items (`Math.round` once per line); `low`/`high` rounded to nearest $100; monthly payment rounded to cents.
- Margin applies to every line **except `permit`**; HVHZ adder applies to `materials` and `labor` only, **before** margin.
- Every `Estimate` carries `configVersion` copied from the config used.
- Commit after every green test cycle. Conventional commits (`feat(pricing): …`).

## Later plans (not this document)

Plan 2 Terraform/CI · Plan 3 Lambda API · Plan 4 React SPA. Interfaces they consume are the `Produces` blocks of Tasks 2–7.

---

### Task 1: Monorepo scaffold

**Files:**
- Create: `package.json`, `tsconfig.base.json`, `.gitignore`, `.nvmrc`

**Interfaces:**
- Consumes: nothing (first task)
- Produces: npm workspace root that later tasks install/test through (`npm test` runs all workspace test scripts)

- [ ] **Step 1: Write root config files**

`package.json`:
```json
{
  "name": "comforthomequote",
  "private": true,
  "workspaces": ["packages/*", "app/*"],
  "engines": { "node": ">=20" },
  "scripts": {
    "test": "npm run test --workspaces --if-present",
    "typecheck": "npm run typecheck --workspaces --if-present"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "vitest": "^3.0.0"
  }
}
```

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "noUncheckedIndexedAccess": true
  }
}
```

`.gitignore`:
```
node_modules/
dist/
.env
*.tfstate*
.terraform/
coverage/
```

`.nvmrc`:
```
22
```

- [ ] **Step 2: Install and verify**

Run: `node --version && npm install && npm test`
Expected: node ≥ v20, install succeeds, `npm test` exits 0 (no workspaces have tests yet).

- [ ] **Step 3: Commit**

```bash
git add package.json tsconfig.base.json .gitignore .nvmrc package-lock.json
git commit -m "chore: monorepo scaffold (npm workspaces, TS, vitest)"
```

---

### Task 2: Pricing package scaffold — types + versioned config

**Files:**
- Create: `packages/pricing/package.json`, `packages/pricing/tsconfig.json`, `packages/pricing/src/types.ts`, `packages/pricing/src/config/fl-defaults.json`, `packages/pricing/src/config.ts`, `packages/pricing/src/index.ts`
- Test: `packages/pricing/test/config.test.ts`

**Interfaces:**
- Consumes: workspace root from Task 1
- Produces (used by every later task and by Plans 3–4):
  - Types: `Material = 'threeTab'|'architectural'|'metal'|'tile'`, `PitchClass = 'walkable'|'steep'|'verySteep'`, `Complexity = 'simple'|'average'|'cutUp'`, `RoofInput`, `Selections`, `LineItem`, `Estimate`, `PricingConfig`
  - Value: `defaultConfig: PricingConfig` (version `"2026-08-13.1"`)

- [ ] **Step 1: Write package scaffolding**

`packages/pricing/package.json`:
```json
{
  "name": "@chq/pricing",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  }
}
```
(Consumers import TS source directly — esbuild/Vite in Plans 3–4 bundle it; no build step here.)

`packages/pricing/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src", "test"]
}
```

- [ ] **Step 2: Write the failing test**

`packages/pricing/test/config.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { defaultConfig } from '../src/config';

describe('defaultConfig', () => {
  it('has a dated version string', () => {
    expect(defaultConfig.version).toMatch(/^\d{4}-\d{2}-\d{2}\.\d+$/);
  });
  it('covers all four materials and the seven seeded counties plus default', () => {
    expect(Object.keys(defaultConfig.materialPerSquare).sort()).toEqual(
      ['architectural', 'metal', 'threeTab', 'tile']
    );
    for (const c of ['Hillsborough','Pinellas','Pasco','Sarasota','Miami-Dade','Broward','Palm Beach','default']) {
      expect(defaultConfig.permitByCounty[c]).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -w @chq/pricing`
Expected: FAIL — cannot resolve `../src/config`.

- [ ] **Step 4: Write types, config JSON, and config loader**

`packages/pricing/src/types.ts`:
```ts
export type Material = 'threeTab' | 'architectural' | 'metal' | 'tile';
export type PitchClass = 'walkable' | 'steep' | 'verySteep';
export type Complexity = 'simple' | 'average' | 'cutUp';

export interface RoofInput {
  areaSqft: number;      // total roof surface area, sq ft
  pitchDeg: number;      // dominant pitch, degrees
  stories: 1 | 2 | 3;
  complexity: Complexity;
  county: string;        // e.g. "Hillsborough"; unknown counties use config default
  hvhz: boolean;         // Miami-Dade / Broward high-velocity hurricane zone
}

export interface Selections {
  material: Material;
  underlaymentUpgrade: boolean;
  ridgeVent: boolean;
  skylights: number;     // count, ≥ 0
  gutterLf: number;      // linear feet, ≥ 0
  solarReady: boolean;
}

export interface LineItem {
  key: string;           // stable id: materials|labor|underlayment|ridgeVent|skylights|gutters|solarReady|permit|disposal
  label: string;         // display text
  amount: number;        // whole USD
}

export interface Estimate {
  configVersion: string;
  squares: number;       // roofing squares incl. waste, 1 decimal
  lineItems: LineItem[];
  subtotal: number;      // whole USD, sum of line items
  low: number;           // subtotal - band, rounded to $100
  high: number;          // subtotal + band, rounded to $100
}

export interface PricingConfig {
  version: string;
  wastePct: Record<Complexity, number>;          // integer %
  materialPerSquare: Record<Material, number>;   // material-only $/square
  laborPerSquare: Record<PitchClass, number>;    // $/square
  storiesFactorPct: Record<'1' | '2' | '3', number>; // integer %, 100 = ×1.0
  pitchBreaksDeg: { steepFrom: number; verySteepFrom: number };
  permitByCounty: Record<string, number>;        // must include "default"
  hvhzPct: number;                               // integer %
  disposalPerSquare: number;
  underlaymentUpgradePerSquare: number;
  ridgeVentFlat: number;
  perSkylight: number;
  gutterPerLf: number;
  solarReadyFlat: number;
  marginPct: number;                             // integer %
  bandPct: number;                               // integer %, estimate range ±
}
```

`packages/pricing/src/config/fl-defaults.json` (ALL dollar/percent values are SEED defaults — Kyle/Dylan tune before launch):
```json
{
  "version": "2026-08-13.1",
  "wastePct": { "simple": 10, "average": 15, "cutUp": 22 },
  "materialPerSquare": { "threeTab": 120, "architectural": 140, "metal": 450, "tile": 500 },
  "laborPerSquare": { "walkable": 175, "steep": 250, "verySteep": 350 },
  "storiesFactorPct": { "1": 100, "2": 110, "3": 125 },
  "pitchBreaksDeg": { "steepFrom": 26.6, "verySteepFrom": 36.9 },
  "permitByCounty": {
    "Hillsborough": 425, "Pinellas": 400, "Pasco": 350, "Sarasota": 375,
    "Miami-Dade": 600, "Broward": 550, "Palm Beach": 500, "default": 400
  },
  "hvhzPct": 12,
  "disposalPerSquare": 55,
  "underlaymentUpgradePerSquare": 45,
  "ridgeVentFlat": 650,
  "perSkylight": 750,
  "gutterPerLf": 12,
  "solarReadyFlat": 500,
  "marginPct": 30,
  "bandPct": 8
}
```

`packages/pricing/src/config.ts`:
```ts
import raw from './config/fl-defaults.json';
import type { PricingConfig } from './types';

export const defaultConfig: PricingConfig = raw;
```

`packages/pricing/src/index.ts`:
```ts
export * from './types';
export { defaultConfig } from './config';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -w @chq/pricing && npm run typecheck -w @chq/pricing`
Expected: PASS (2 tests), typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add packages/pricing
git commit -m "feat(pricing): package scaffold, domain types, versioned FL seed config"
```

---

### Task 3: Pitch classification

**Files:**
- Create: `packages/pricing/src/pitch.ts`
- Modify: `packages/pricing/src/index.ts`
- Test: `packages/pricing/test/pitch.test.ts`

**Interfaces:**
- Consumes: `PricingConfig`, `PitchClass`, `defaultConfig` (Task 2)
- Produces: `pitchClassFromDeg(pitchDeg: number, config?: PricingConfig): PitchClass`

- [ ] **Step 1: Write the failing test**

`packages/pricing/test/pitch.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { pitchClassFromDeg } from '../src/pitch';

describe('pitchClassFromDeg', () => {
  it('classifies below steepFrom as walkable', () => {
    expect(pitchClassFromDeg(0)).toBe('walkable');
    expect(pitchClassFromDeg(20)).toBe('walkable');
  });
  it('classifies [steepFrom, verySteepFrom) as steep — boundary inclusive', () => {
    expect(pitchClassFromDeg(26.6)).toBe('steep');   // exactly 6/12
    expect(pitchClassFromDeg(30)).toBe('steep');
  });
  it('classifies >= verySteepFrom as verySteep — boundary inclusive', () => {
    expect(pitchClassFromDeg(36.9)).toBe('verySteep'); // exactly 9/12
    expect(pitchClassFromDeg(45)).toBe('verySteep');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w @chq/pricing`
Expected: FAIL — cannot resolve `../src/pitch`.

- [ ] **Step 3: Implement**

`packages/pricing/src/pitch.ts`:
```ts
import type { PitchClass, PricingConfig } from './types';
import { defaultConfig } from './config';

export function pitchClassFromDeg(
  pitchDeg: number,
  config: PricingConfig = defaultConfig
): PitchClass {
  if (pitchDeg >= config.pitchBreaksDeg.verySteepFrom) return 'verySteep';
  if (pitchDeg >= config.pitchBreaksDeg.steepFrom) return 'steep';
  return 'walkable';
}
```

Append to `packages/pricing/src/index.ts`:
```ts
export { pitchClassFromDeg } from './pitch';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -w @chq/pricing`
Expected: PASS (5 tests total).

- [ ] **Step 5: Commit**

```bash
git add packages/pricing
git commit -m "feat(pricing): pitch degree -> labor class mapping"
```

---

### Task 4: Monthly payment calculator

**Files:**
- Create: `packages/pricing/src/finance.ts`
- Modify: `packages/pricing/src/index.ts`
- Test: `packages/pricing/test/finance.test.ts`

**Interfaces:**
- Consumes: nothing new
- Produces: `monthlyPayment(principal: number, aprPct: number, months: number): number` (USD, cents precision; throws `RangeError` on principal ≤ 0 or months ≤ 0 or aprPct < 0)

- [ ] **Step 1: Write the failing test**

`packages/pricing/test/finance.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { monthlyPayment } from '../src/finance';

describe('monthlyPayment', () => {
  it('amortizes a standard loan (15000 @ 7.99% / 120mo ≈ 181.91)', () => {
    expect(monthlyPayment(15000, 7.99, 120)).toBeCloseTo(181.91, 1);
  });
  it('handles zero APR as simple division', () => {
    expect(monthlyPayment(12000, 0, 60)).toBe(200);
  });
  it('rejects nonsense inputs', () => {
    expect(() => monthlyPayment(0, 7.99, 120)).toThrow(RangeError);
    expect(() => monthlyPayment(15000, 7.99, 0)).toThrow(RangeError);
    expect(() => monthlyPayment(15000, -1, 120)).toThrow(RangeError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w @chq/pricing`
Expected: FAIL — cannot resolve `../src/finance`.

- [ ] **Step 3: Implement**

`packages/pricing/src/finance.ts`:
```ts
export function monthlyPayment(principal: number, aprPct: number, months: number): number {
  if (principal <= 0) throw new RangeError('principal must be > 0');
  if (months <= 0 || !Number.isInteger(months)) throw new RangeError('months must be a positive integer');
  if (aprPct < 0) throw new RangeError('aprPct must be >= 0');
  const r = aprPct / 100 / 12;
  const raw = r === 0 ? principal / months : (principal * r) / (1 - Math.pow(1 + r, -months));
  return Math.round(raw * 100) / 100;
}
```

Append to `packages/pricing/src/index.ts`:
```ts
export { monthlyPayment } from './finance';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -w @chq/pricing`
Expected: PASS (8 tests total).

- [ ] **Step 5: Commit**

```bash
git add packages/pricing
git commit -m "feat(pricing): monthly payment amortization"
```

---

### Task 5: Estimate core — squares, materials, labor, permit, disposal, margin, range

**Files:**
- Create: `packages/pricing/src/estimate.ts`
- Modify: `packages/pricing/src/index.ts`
- Test: `packages/pricing/test/estimate.test.ts`

**Interfaces:**
- Consumes: all types (Task 2), `pitchClassFromDeg` (Task 3)
- Produces: `computeEstimate(roof: RoofInput, sel: Selections, config?: PricingConfig): Estimate` — THE function Plans 3–4 call. Line-item keys produced here: `materials`, `labor`, `permit`, `disposal`.

**Money rules (from Global Constraints, restated):** per line: `amount = Math.round(base × (100 + marginPct) / 100)` except `permit` which is at-cost. `subtotal` = sum of rounded lines. `low/high` = `subtotal × (100 ∓ bandPct) / 100` rounded to nearest $100.

- [ ] **Step 1: Write the failing golden-case test**

Hand-computed golden case — architectural shingle, Hillsborough, 2,000 sq ft, average complexity, 20° pitch (walkable), 1 story, no options:
squares = 2000×115/10000 = 23.0 · materials = 23×140=3220 → ×1.30 = 4186 · labor = 23×175×1.00=4025 → ×1.30 = 5233 · permit = 425 (no margin) · disposal = 23×55=1265 → ×1.30 = 1645 · subtotal = 11489 · low = round100(11489×0.92)=10600 · high = round100(11489×1.08)=12400.

`packages/pricing/test/estimate.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { computeEstimate } from '../src/estimate';
import type { RoofInput, Selections } from '../src/types';

export const baseRoof: RoofInput = {
  areaSqft: 2000, pitchDeg: 20, stories: 1,
  complexity: 'average', county: 'Hillsborough', hvhz: false,
};
export const baseSel: Selections = {
  material: 'architectural', underlaymentUpgrade: false, ridgeVent: false,
  skylights: 0, gutterLf: 0, solarReady: false,
};

const item = (e: ReturnType<typeof computeEstimate>, key: string) =>
  e.lineItems.find(li => li.key === key)?.amount;

describe('computeEstimate core', () => {
  it('matches the hand-computed golden case', () => {
    const e = computeEstimate(baseRoof, baseSel);
    expect(e.squares).toBe(23);
    expect(item(e, 'materials')).toBe(4186);
    expect(item(e, 'labor')).toBe(5233);
    expect(item(e, 'permit')).toBe(425);
    expect(item(e, 'disposal')).toBe(1645);
    expect(e.subtotal).toBe(11489);
    expect(e.low).toBe(10600);
    expect(e.high).toBe(12400);
    expect(e.configVersion).toBe('2026-08-13.1');
  });
  it('omits option line items when no options selected', () => {
    const keys = computeEstimate(baseRoof, baseSel).lineItems.map(li => li.key);
    expect(keys).toEqual(['materials', 'labor', 'permit', 'disposal']);
  });
  it('applies stories factor to labor (2-story = +10%)', () => {
    const e = computeEstimate({ ...baseRoof, stories: 2 }, baseSel);
    // 23 × 175 × 110/100 = 4427.5, then margin: ×130/100 = 5755.75 → round = 5756
    expect(item(e, 'labor')).toBe(5756);
  });
  it('uses steep labor rate from pitch degrees', () => {
    const e = computeEstimate({ ...baseRoof, pitchDeg: 30 }, baseSel);
    // 23 × 250 = 5750 → ×1.30 = 7475
    expect(item(e, 'labor')).toBe(7475);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w @chq/pricing`
Expected: FAIL — cannot resolve `../src/estimate`.

- [ ] **Step 3: Implement**

`packages/pricing/src/estimate.ts`:
```ts
import type { Estimate, LineItem, PricingConfig, RoofInput, Selections } from './types';
import { defaultConfig } from './config';
import { pitchClassFromDeg } from './pitch';

const roundTo100 = (x: number) => Math.round(x / 100) * 100;

export function computeEstimate(
  roof: RoofInput,
  sel: Selections,
  config: PricingConfig = defaultConfig
): Estimate {
  const wastePct = config.wastePct[roof.complexity];
  const squaresRaw = (roof.areaSqft * (100 + wastePct)) / 10000;
  const squares = Math.round(squaresRaw * 10) / 10;

  const hvhz = (base: number) =>
    roof.hvhz ? (base * (100 + config.hvhzPct)) / 100 : base;
  const withMargin = (base: number) =>
    Math.round((base * (100 + config.marginPct)) / 100);

  const pitchClass = pitchClassFromDeg(roof.pitchDeg, config);
  const storiesPct = config.storiesFactorPct[String(roof.stories) as '1' | '2' | '3'];

  const materialsBase = hvhz(squaresRaw * config.materialPerSquare[sel.material]);
  const laborBase = hvhz((squaresRaw * config.laborPerSquare[pitchClass] * storiesPct) / 100);
  const permit = config.permitByCounty[roof.county] ?? config.permitByCounty['default']!;

  const lineItems: LineItem[] = [
    { key: 'materials', label: 'Materials', amount: withMargin(materialsBase) },
    { key: 'labor', label: 'Labor', amount: withMargin(laborBase) },
  ];
  if (sel.underlaymentUpgrade) lineItems.push({
    key: 'underlayment', label: 'Peel & stick underlayment upgrade',
    amount: withMargin(squaresRaw * config.underlaymentUpgradePerSquare),
  });
  if (sel.ridgeVent) lineItems.push({
    key: 'ridgeVent', label: 'Ridge vent', amount: withMargin(config.ridgeVentFlat),
  });
  if (sel.skylights > 0) lineItems.push({
    key: 'skylights', label: `Skylights (${sel.skylights})`,
    amount: withMargin(sel.skylights * config.perSkylight),
  });
  if (sel.gutterLf > 0) lineItems.push({
    key: 'gutters', label: `Gutters (${sel.gutterLf} ln ft)`,
    amount: withMargin(sel.gutterLf * config.gutterPerLf),
  });
  if (sel.solarReady) lineItems.push({
    key: 'solarReady', label: 'Solar-ready prep', amount: withMargin(config.solarReadyFlat),
  });
  lineItems.push({ key: 'permit', label: `${roof.county} County permit & inspections`, amount: permit });
  lineItems.push({
    key: 'disposal', label: 'Tear-off & disposal',
    amount: withMargin(squaresRaw * config.disposalPerSquare),
  });

  const subtotal = lineItems.reduce((s, li) => s + li.amount, 0);
  return {
    configVersion: config.version,
    squares,
    lineItems,
    subtotal,
    low: roundTo100((subtotal * (100 - config.bandPct)) / 100),
    high: roundTo100((subtotal * (100 + config.bandPct)) / 100),
  };
}
```

Append to `packages/pricing/src/index.ts`:
```ts
export { computeEstimate } from './estimate';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -w @chq/pricing`
Expected: PASS (12 tests total). Note: option lines appear before `permit`/`disposal` in `lineItems` — the ordering test expects exactly `['materials','labor','permit','disposal']` when no options are selected.

- [ ] **Step 5: Commit**

```bash
git add packages/pricing
git commit -m "feat(pricing): core estimate computation with golden-case tests"
```

---

### Task 6: HVHZ adder, county fallback, option line items

**Files:**
- Test: `packages/pricing/test/estimate.test.ts` (append)

**Interfaces:**
- Consumes: `computeEstimate` (Task 5 — already implements these behaviors; this task pins them with tests)
- Produces: verified behaviors + option line-item keys `underlayment`, `ridgeVent`, `skylights`, `gutters`, `solarReady`

- [ ] **Step 1: Write the tests (some may pass immediately — that's fine, they pin behavior)**

Hand-math for Miami-Dade HVHZ variant of the golden case: materials = 3220×1.12=3606.4 → ×1.30 = 4688.32 → 4688 · labor = 4025×1.12=4508 → ×1.30 = 5860.4 → 5860 · permit 600 · disposal 1645 (HVHZ does not apply) · subtotal = 12793.

Append to `packages/pricing/test/estimate.test.ts`:
```ts
describe('computeEstimate HVHZ + county + options', () => {
  it('applies HVHZ adder to materials and labor only (Miami-Dade golden case)', () => {
    const e = computeEstimate({ ...baseRoof, county: 'Miami-Dade', hvhz: true }, baseSel);
    expect(item(e, 'materials')).toBe(4688);
    expect(item(e, 'labor')).toBe(5860);
    expect(item(e, 'permit')).toBe(600);
    expect(item(e, 'disposal')).toBe(1645); // unchanged by HVHZ
    expect(e.subtotal).toBe(12793);
  });
  it('falls back to default permit for unknown counties', () => {
    const e = computeEstimate({ ...baseRoof, county: 'Okeechobee' }, baseSel);
    expect(item(e, 'permit')).toBe(400);
  });
  it('prices every option with margin applied', () => {
    const e = computeEstimate(baseRoof, {
      ...baseSel, underlaymentUpgrade: true, ridgeVent: true,
      skylights: 2, gutterLf: 120, solarReady: true,
    });
    expect(item(e, 'underlayment')).toBe(1346); // 23×45=1035 → ×1.3 = 1345.5 → 1346
    expect(item(e, 'ridgeVent')).toBe(845);     // 650 → 845
    expect(item(e, 'skylights')).toBe(1950);    // 1500 → 1950
    expect(item(e, 'gutters')).toBe(1872);      // 1440 → 1872
    expect(item(e, 'solarReady')).toBe(650);    // 500 → 650
  });
  it('is deterministic', () => {
    const a = computeEstimate(baseRoof, baseSel);
    const b = computeEstimate(baseRoof, baseSel);
    expect(a).toEqual(b);
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npm test -w @chq/pricing`
Expected: PASS (16 tests). If any fail, the implementation from Task 5 has a bug — fix `estimate.ts`, do not adjust expected values (they are hand-computed).

- [ ] **Step 3: Commit**

```bash
git add packages/pricing
git commit -m "test(pricing): pin HVHZ, county fallback, and option pricing"
```

---

### Task 7: Input validation + public API surface

**Files:**
- Modify: `packages/pricing/src/estimate.ts` (add validation at top of `computeEstimate`)
- Test: `packages/pricing/test/validation.test.ts`
- Modify: `README.md` (usage snippet)

**Interfaces:**
- Consumes: everything prior
- Produces: final `@chq/pricing` public API: `computeEstimate`, `monthlyPayment`, `pitchClassFromDeg`, `defaultConfig`, all types. `computeEstimate` throws `RangeError` for: `areaSqft` outside (0, 30000], negative/non-integer `skylights`, negative `gutterLf`, `pitchDeg` outside [0, 60].

- [ ] **Step 1: Write the failing test**

`packages/pricing/test/validation.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { computeEstimate } from '../src/estimate';
import { baseRoof, baseSel } from './estimate.test';

describe('computeEstimate validation', () => {
  it.each([
    [{ ...baseRoof, areaSqft: 0 }], [{ ...baseRoof, areaSqft: -50 }],
    [{ ...baseRoof, areaSqft: 30001 }], [{ ...baseRoof, pitchDeg: -1 }],
    [{ ...baseRoof, pitchDeg: 61 }],
  ])('rejects bad roof input %j', (roof) => {
    expect(() => computeEstimate(roof, baseSel)).toThrow(RangeError);
  });
  it.each([
    [{ ...baseSel, skylights: -1 }], [{ ...baseSel, skylights: 1.5 }],
    [{ ...baseSel, gutterLf: -10 }],
  ])('rejects bad selections %j', (sel) => {
    expect(() => computeEstimate(baseRoof, sel)).toThrow(RangeError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w @chq/pricing`
Expected: FAIL — no RangeError thrown (8 new tests fail).

- [ ] **Step 3: Implement validation**

Insert at the top of `computeEstimate` in `packages/pricing/src/estimate.ts`:
```ts
  if (!(roof.areaSqft > 0) || roof.areaSqft > 30000)
    throw new RangeError('areaSqft must be in (0, 30000]');
  if (roof.pitchDeg < 0 || roof.pitchDeg > 60)
    throw new RangeError('pitchDeg must be in [0, 60]');
  if (sel.skylights < 0 || !Number.isInteger(sel.skylights))
    throw new RangeError('skylights must be a non-negative integer');
  if (sel.gutterLf < 0) throw new RangeError('gutterLf must be >= 0');
```

- [ ] **Step 4: Run full suite + typecheck**

Run: `npm test -w @chq/pricing && npm run typecheck -w @chq/pricing`
Expected: PASS (24 tests), typecheck clean.

- [ ] **Step 5: Document usage in README**

Append to `README.md` (the inner fences are shown as `~~~` here to avoid markdown nesting — write them as normal triple backticks in the README):
```markdown
## packages/pricing

Deterministic estimate engine. Zero runtime deps.

~~~ts
import { computeEstimate, monthlyPayment } from '@chq/pricing';

const estimate = computeEstimate(
  { areaSqft: 2000, pitchDeg: 20, stories: 1, complexity: 'average', county: 'Hillsborough', hvhz: false },
  { material: 'architectural', underlaymentUpgrade: false, ridgeVent: false, skylights: 0, gutterLf: 0, solarReady: false },
);
// estimate.low..estimate.high, estimate.lineItems, estimate.configVersion
const payment = monthlyPayment(estimate.subtotal, 7.99, 120);
~~~

Seed prices live in `packages/pricing/src/config/fl-defaults.json` — bump `version` on every change.
```

- [ ] **Step 6: Commit**

```bash
git add packages/pricing README.md
git commit -m "feat(pricing): input validation and documented public API"
```
