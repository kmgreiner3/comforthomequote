# ComfortHomeQuote

Instant, transparent roof estimates for Florida homeowners.
Design specs: docs/superpowers/specs/

## packages/pricing

Deterministic estimate engine. Zero runtime deps.

```ts
import { computeEstimate, monthlyPayment } from '@chq/pricing';

const estimate = computeEstimate(
  { areaSqft: 2000, pitchDeg: 20, stories: 1, complexity: 'average', county: 'Hillsborough', hvhz: false },
  { material: 'architectural', underlaymentUpgrade: false, ridgeVent: false, skylights: 0, gutterLf: 0, solarReady: false },
);
// estimate.low..estimate.high, estimate.lineItems, estimate.configVersion
const payment = monthlyPayment(estimate.subtotal, 7.99, 120);
```

Seed prices live in `packages/pricing/src/config/fl-defaults.json` — bump `version` on every change.
