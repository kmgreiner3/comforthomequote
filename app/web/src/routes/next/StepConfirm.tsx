import { useNavigate } from 'react-router-dom';
import { SHINGLES } from '@chq/pricing';
import { selectGuarantee, selectMonthly, selectTotal, useBuild } from '../../state/build';
import { perMonth, usd } from '../../lib/format';
import { SecondaryLinkButton, StepHeading } from '../build/ui';
import { RevealGroup, RevealItem } from '../build/motion';

const UNDERLAYMENT_SUMMARY: Record<'synthetic' | 'peel-stick', string> = {
  synthetic: 'Standard Synthetic',
  'peel-stick': 'Premium Peel & Stick',
};

const NEXT_STEPS = [
  'Your project information is reviewed.',
  'Your project manager completes the pre-installation visit.',
  'Your permit process begins.',
  'Your installation is scheduled.',
  'You receive updates as your project moves forward.',
];

function formatVisitDate(dateStr: string): string {
  const parts = dateStr.split('-').map(Number);
  const y = parts[0] ?? 1970;
  const m = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-navy-950/10 py-3 last:border-b-0">
      <span className="text-sm text-ink/60">{label}</span>
      <span className="text-right text-sm font-semibold text-navy-950">{value}</span>
    </div>
  );
}

export default function StepConfirm() {
  const state = useBuild();
  const resetQuote = useBuild((s) => s.resetQuote);
  const navigate = useNavigate();
  const { shingle, color, underlayment, address, visit } = state;
  if (shingle == null || color == null || visit == null) return null; // shouldn't render: gated behind the full flow

  const total = selectTotal(state);
  const monthly = selectMonthly(state);
  const guaranteeInfo = selectGuarantee(state);
  if (total == null || monthly == null || guaranteeInfo == null) return null;

  // The quote is already complete and submitted -- unlike the rail/Review
  // "start over" affordances, there's nothing left here to lose, so this one
  // resets straight away with no inline confirm step.
  function handleStartNew() {
    resetQuote();
    navigate('/build#address');
  }

  return (
    <RevealGroup>
      <RevealItem>
        <StepHeading eyebrow="You're all set" title="We've got it from here." />
      </RevealItem>

      <RevealItem className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-5 lg:col-span-3">
          <div className="rounded-2xl border-2 border-navy-950/10 bg-white p-6">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-blue-600">
              Your roof
            </p>
            <SummaryRow label="System" value={SHINGLES[shingle].name} />
            <SummaryRow label="Color" value={color} />
            <SummaryRow label="Underlayment" value={UNDERLAYMENT_SUMMARY[underlayment]} />
            <SummaryRow label="Protection level" value={guaranteeInfo.level} />
            <SummaryRow label="Workmanship guarantee" value={`${guaranteeInfo.years} years`} />
            <SummaryRow label="Property" value={address ?? 'Not provided'} />
          </div>

          <div className="rounded-2xl border-2 border-navy-950/10 bg-white p-6">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-blue-600">
              Your visit
            </p>
            <SummaryRow label="Date" value={formatVisitDate(visit.date)} />
            <SummaryRow label="Time window" value={visit.window} />
          </div>

          <div className="rounded-2xl border-2 border-navy-950/10 bg-white p-6">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-blue-600">
              What happens next
            </p>
            <ol className="space-y-2">
              {NEXT_STEPS.map((step, i) => (
                <li key={step} className="flex gap-3 text-sm text-ink/80">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-navy-950/10 text-xs font-bold text-navy-950">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="rounded-2xl bg-navy-950 p-6 text-white">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/60">
              Project price
            </p>
            <p className="mt-2 font-display text-4xl font-semibold tabular-nums">{usd(total)}</p>
            <p className="mt-1 text-sm text-white/70">or approximately {perMonth(monthly)}*</p>
          </div>

          <p className="mt-6 text-base leading-relaxed text-ink/80">
            You did the research. You built your roof. You made the decision. Now we&apos;ll take
            care of bringing it to life.
          </p>

          <div className="mt-6">
            <SecondaryLinkButton onClick={handleStartNew} className="w-full text-center">
              Start a New Quote
            </SecondaryLinkButton>
          </div>
        </div>
      </RevealItem>
    </RevealGroup>
  );
}
