import { peelStickUpgrade } from '@chq/pricing';
import { useBuild } from '../../state/build';
import { usd } from '../../lib/format';
import { BackChevron, IncludedBadge, PrimaryButton, SelectionCard, StepHeading } from './ui';
import { RevealGroup, RevealItem } from './motion';
import type { Underlayment } from '@chq/pricing';

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
  const underlayment = useBuild((s) => s.underlayment);
  const setUnderlayment = useBuild((s) => s.setUnderlayment);

  if (sq == null) return null; // shouldn't render: gated behind a valid home size

  const delta = peelStickUpgrade(sq);

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
