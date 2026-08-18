import { useState } from 'react';
import { configuredTotal, estimatedMonthly, titanUpgrade, SHINGLES, type ShingleKey } from '@chq/pricing';
import { useBuild } from '../../state/build';
import { perMonth, usd } from '../../lib/format';
import { BackChevron, SelectionCard, StepHeading } from './ui';
import { RevealGroup, RevealItem } from './motion';
import { useDelayedContinue } from './useDelayedContinue';
import Drawer from './Drawer';
import { WARRANTY_FOOTNOTE } from '../../content/footnote';

export default function StepShingle({ onContinue, onBack }: { onContinue: () => void; onBack: () => void }) {
  const sq = useBuild((s) => s.sq);
  const underlayment = useBuild((s) => s.underlayment);
  const shingle = useBuild((s) => s.shingle);
  const setShingle = useBuild((s) => s.setShingle);
  const [drawerKey, setDrawerKey] = useState<ShingleKey | null>(null);
  const advance = useDelayedContinue(onContinue);

  if (sq == null) return null; // shouldn't render: gated behind a valid home size

  const betterTotal = configuredTotal(sq, 'iko-cambridge', underlayment);
  const betterMonthly = estimatedMonthly(betterTotal);
  const delta = titanUpgrade(sq);
  const bestTotal = betterTotal + delta;
  const monthlyDelta = estimatedMonthly(bestTotal) - betterMonthly;

  function select(key: ShingleKey) {
    setShingle(key);
    advance();
  }

  return (
    <>
      <RevealGroup>
        <RevealItem>
          <BackChevron onClick={onBack} />
          <StepHeading
            eyebrow="Shingle"
            title="Choose your shingle"
            subtitle="Your shingles are your home's primary layer of protection, and one of the biggest factors in how your new roof looks and performs. We've simplified the decision to two options."
          />
        </RevealItem>

        <RevealItem className="grid gap-5 md:grid-cols-2">
          <div className="flex flex-col gap-3">
            <SelectionCard selected={shingle === 'iko-cambridge'} onSelect={() => select('iko-cambridge')}>
              <p className="text-xs font-bold uppercase tracking-wide text-blue-600">Better</p>
              <p className="mt-1 font-display text-2xl font-semibold">{SHINGLES['iko-cambridge'].name}</p>
              <p className="mt-1 text-sm opacity-80">{SHINGLES['iko-cambridge'].tagline}</p>
              <p className="mt-5 font-display text-3xl font-semibold tabular-nums">{usd(betterTotal)}</p>
              <p className="mt-1 text-sm opacity-80">or approximately {perMonth(betterMonthly)}</p>
              <ul className="mt-5 space-y-1.5 text-sm opacity-90">
                {SHINGLES['iko-cambridge'].highlights.slice(0, 3).map((h) => (
                  <li key={h} className="flex gap-2">
                    <span aria-hidden="true">&bull;</span>
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
              <span className="mt-5 inline-block rounded-full border border-current px-4 py-1.5 text-xs font-bold uppercase tracking-wide">
                Select
              </span>
            </SelectionCard>
            <button
              type="button"
              onClick={() => setDrawerKey('iko-cambridge')}
              className="self-start text-sm font-semibold text-blue-600 hover:text-blue-500"
            >
              Learn more
            </button>
          </div>

          <div className="flex flex-col gap-3">
            <SelectionCard selected={shingle === 'tamko-titan-xt'} onSelect={() => select('tamko-titan-xt')}>
              <p className="text-xs font-bold uppercase tracking-wide text-blue-600">Best</p>
              <p className="mt-1 font-display text-2xl font-semibold">{SHINGLES['tamko-titan-xt'].name}</p>
              <p className="mt-1 text-sm opacity-80">{SHINGLES['tamko-titan-xt'].tagline}</p>
              <p className="mt-5 font-display text-3xl font-semibold tabular-nums">+{usd(delta)}</p>
              <p className="mt-1 text-sm opacity-80">or approximately +{perMonth(monthlyDelta)}</p>
              <ul className="mt-5 space-y-1.5 text-sm opacity-90">
                {SHINGLES['tamko-titan-xt'].highlights.slice(0, 3).map((h) => (
                  <li key={h} className="flex gap-2">
                    <span aria-hidden="true">&bull;</span>
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
              <span className="mt-5 inline-block rounded-full border border-current px-4 py-1.5 text-xs font-bold uppercase tracking-wide">
                Upgrade
              </span>
            </SelectionCard>
            <button
              type="button"
              onClick={() => setDrawerKey('tamko-titan-xt')}
              className="self-start text-sm font-semibold text-blue-600 hover:text-blue-500"
            >
              Learn more
            </button>
          </div>
        </RevealItem>
      </RevealGroup>

      <Drawer
        open={drawerKey != null}
        onClose={() => setDrawerKey(null)}
        title={drawerKey ? SHINGLES[drawerKey].name : ''}
      >
        {drawerKey && (
          <div>
            <p className="mb-4 text-sm font-medium text-ink/70">{SHINGLES[drawerKey].tagline}</p>
            <ul className="space-y-2 text-sm text-ink/90">
              {SHINGLES[drawerKey].highlights.map((h) => (
                <li key={h} className="flex gap-2">
                  <span aria-hidden="true">&bull;</span>
                  <span>{h}</span>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-xs text-ink/50">*{WARRANTY_FOOTNOTE}</p>
          </div>
        )}
      </Drawer>
    </>
  );
}
