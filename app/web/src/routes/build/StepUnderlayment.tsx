import { useState } from 'react';
import { useBuild } from '../../state/build';
import { usd } from '../../lib/format';
import { BackChevron, IncludedBadge, PrimaryButton, SelectionCard, StepHeading } from './ui';
import { RevealGroup, RevealItem } from './motion';

// round8: removed in commit 2. This whole step is dead once peel & stick
// is standard for everyone (StepUnderlayment is deleted in Commit 2). The
// store no longer has an underlayment field or the Underlayment type, so
// this local type/stand-in state keeps the component compiling without a
// redesign in the meantime.
type Underlayment = 'synthetic' | 'peel-stick';

const STANDARD_BENEFITS = [
  'Approved synthetic underlayment',
  'Mechanically fastened',
  'Meets applicable Florida requirements',
];

const PREMIUM_BENEFITS = [
  'Self-adhered directly to your roof decking',
  'Continuous secondary water barrier',
  'Additional severe-weather protection',
];

export default function StepUnderlayment({ onContinue, onBack }: { onContinue: () => void; onBack: () => void }) {
  const sq = useBuild((s) => s.sq);
  // round8: removed in commit 2. Local stand-in, no longer a store field.
  const [underlayment, setUnderlayment] = useState<Underlayment>('peel-stick');

  if (sq == null) return null; // shouldn't render: gated behind a valid home size

  // round8: removed in commit 2. Peel & stick is baked into every total
  // now, so there is no separate upgrade price to show here.
  const delta = 0;

  // Selecting only selects (underlayment always has a valid default, so
  // Continue is never blocked here); advancing is the explicit tap below.
  function select(u: Underlayment) {
    setUnderlayment(u);
  }

  return (
    <RevealGroup>
      <RevealItem>
        <BackChevron onClick={onBack} />
        <StepHeading
          eyebrow="Underlayment"
          title="What's under your shingles matters"
          subtitle="Underlayment sits over your decking, beneath your shingles. If shingles are ever damaged or lifted in severe weather, it's your roof's secondary line of defense against water."
        />
      </RevealItem>

      <RevealItem className="grid gap-5 md:grid-cols-2">
        <SelectionCard selected={underlayment === 'synthetic'} onSelect={() => select('synthetic')}>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-bold uppercase tracking-wide text-blue-600">Standard</p>
            <IncludedBadge />
          </div>
          <p className="mt-1 font-display text-2xl font-semibold">Synthetic</p>
          <ul className="mt-5 space-y-1.5 text-sm opacity-90">
            {STANDARD_BENEFITS.map((b) => (
              <li key={b} className="flex gap-2">
                <span aria-hidden="true">&bull;</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </SelectionCard>

        <SelectionCard selected={underlayment === 'peel-stick'} onSelect={() => select('peel-stick')}>
          <p className="text-xs font-bold uppercase tracking-wide text-blue-600">Premium</p>
          <p className="mt-1 font-display text-2xl font-semibold">Full Peel &amp; Stick</p>
          <p className="mt-1 text-sm opacity-80">Enhanced secondary water protection.</p>
          <p className="mt-5 font-display text-3xl font-semibold tabular-nums">+{usd(delta)}</p>
          <ul className="mt-5 space-y-1.5 text-sm opacity-90">
            {PREMIUM_BENEFITS.map((b) => (
              <li key={b} className="flex gap-2">
                <span aria-hidden="true">&bull;</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
          <span className="mt-5 inline-block rounded-full bg-amber-400 px-4 py-1.5 text-xs font-bold text-navy-950">
            +5 YEARS added to your guarantee
          </span>
        </SelectionCard>
      </RevealItem>

      <RevealItem>
        <PrimaryButton className="mt-8" onClick={onContinue}>
          Continue
        </PrimaryButton>
      </RevealItem>
    </RevealGroup>
  );
}
