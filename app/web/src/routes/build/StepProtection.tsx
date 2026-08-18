import type { ReactNode } from 'react';
import { SHINGLES } from '@chq/pricing';
import { useBuild, selectGuarantee } from '../../state/build';
import { BackChevron, PrimaryButton, StepHeading } from './ui';
import { RevealGroup, RevealItem } from './motion';

const UNDERLAYMENT_LABEL: Record<'synthetic' | 'peel-stick', string> = {
  synthetic: 'Synthetic Underlayment',
  'peel-stick': 'Peel & Stick Underlayment',
};

function Term({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border-2 border-navy-950/15 bg-white px-5 py-4 text-center font-display text-base font-semibold text-navy-950 sm:text-lg">
      {children}
    </div>
  );
}

function Op({ children }: { children: ReactNode }) {
  return <div className="font-display text-2xl font-semibold text-blue-600">{children}</div>;
}

export default function StepProtection({ onContinue, onBack }: { onContinue: () => void; onBack: () => void }) {
  const state = useBuild();
  const shingle = state.shingle;

  if (shingle == null) return null; // shouldn't render: gated behind a shingle choice

  const guaranteeInfo = selectGuarantee(state);
  if (!guaranteeInfo) return null;

  return (
    <RevealGroup>
      <RevealItem>
        <BackChevron onClick={onBack} />
        <StepHeading eyebrow="Protection level" title={`Your roof is ${guaranteeInfo.level}`} />
      </RevealItem>

      <RevealItem className="grid grid-cols-2 items-center gap-3 sm:grid-cols-5 sm:gap-4">
        <Term>{SHINGLES[shingle].name}</Term>
        <Op>+</Op>
        <Term>{UNDERLAYMENT_LABEL[state.underlayment]}</Term>
        <Op>=</Op>
        <div className="col-span-2 sm:col-span-1">
          <div className="rounded-2xl bg-amber-400 px-5 py-4 text-center font-display text-lg font-bold text-navy-950">
            {guaranteeInfo.years}-Year Guarantee
          </div>
        </div>
      </RevealItem>

      <RevealItem>
        <p className="mt-6 max-w-xl text-base text-ink/70">
          Your shingle and underlayment work together. Together they set your Workmanship Guarantee.
        </p>
      </RevealItem>

      <RevealItem>
        <PrimaryButton className="mt-8" onClick={onContinue}>
          Continue
        </PrimaryButton>
      </RevealItem>
    </RevealGroup>
  );
}
