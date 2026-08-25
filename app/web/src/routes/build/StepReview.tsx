import { useNavigate } from 'react-router-dom';
import { SHINGLES } from '@chq/pricing';
import {
  selectCash,
  selectGuarantee,
  selectMonthly,
  selectTotal,
  useBuild,
} from '../../state/build';
import { perMonth, usd } from '../../lib/format';
import { DECKING_DISCLOSURE, INCLUDED_TILES } from '../../content/included';
import { CheckMark, SecondaryLinkButton, StartOverLink, StepHeading } from './ui';
import { RevealGroup, RevealItem } from './motion';

const UNDERLAYMENT_SUMMARY: Record<'synthetic' | 'peel-stick', string> = {
  synthetic: 'Standard Synthetic',
  'peel-stick': 'Premium Peel & Stick',
};

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-navy-950/10 py-3 last:border-b-0">
      <span className="text-sm text-ink/60">{label}</span>
      <span className="text-right text-sm font-semibold text-navy-950">{value}</span>
    </div>
  );
}

export default function StepReview({
  onEdit,
  onStartOver,
}: {
  onEdit: () => void;
  onStartOver: () => void;
}) {
  const state = useBuild();
  const navigate = useNavigate();

  const { address, shingle, color, underlayment, dripEdge } = state;
  if (shingle == null || color == null || dripEdge == null) return null; // shouldn't render: gated behind full config

  const total = selectTotal(state);
  const monthly = selectMonthly(state);
  const cash = selectCash(state);
  const guaranteeInfo = selectGuarantee(state);
  if (total == null || monthly == null || cash == null || guaranteeInfo == null) return null;

  function handleReady() {
    state.accept();
    navigate('/next');
  }

  return (
    <RevealGroup>
      <RevealItem>
        <StepHeading eyebrow="Review" title="Here's what you built" />
      </RevealItem>

      <RevealItem className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <div className="rounded-2xl border-2 border-navy-950/10 bg-white p-6">
            {address && <SummaryRow label="Property" value={address} />}
            <SummaryRow label="System" value={SHINGLES[shingle].name} />
            <SummaryRow label="Color" value={color} />
            <SummaryRow label="Underlayment" value={UNDERLAYMENT_SUMMARY[underlayment]} />
            <SummaryRow label="Drip edge" value={dripEdge} />
            <SummaryRow label="Protection level" value={guaranteeInfo.level} />
            <SummaryRow label="Workmanship guarantee" value={`${guaranteeInfo.years} years`} />
          </div>

          <div className="mt-5 rounded-2xl border-2 border-navy-950/10 bg-white p-6">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-blue-600">
              Included with every roof
            </p>
            <ul className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
              {INCLUDED_TILES.map((tile) => (
                <li key={tile.id} className="flex items-center gap-2 text-sm text-ink/80">
                  <CheckMark className="h-4 w-4 shrink-0 text-blue-600" />
                  {tile.title}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="rounded-2xl bg-navy-950 p-6 text-white">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/60">Your price</p>
            <p className="mt-2 font-display text-4xl font-semibold tabular-nums">{usd(total)}</p>
            <p className="mt-1 text-sm text-white/70">or approximately {perMonth(monthly)}*</p>
            <p className="mt-4 border-t border-white/10 pt-4 text-sm text-white/80">
              Pay cash: {usd(cash)} (5% discount, half upfront and half on completion)
            </p>
          </div>

          <p className="mt-4 text-xs leading-relaxed text-ink/50">{DECKING_DISCLOSURE}</p>

          <div className="mt-8">
            <button
              type="button"
              onClick={handleReady}
              className="w-full rounded-2xl bg-blue-600 px-8 py-6 text-xl font-bold text-white shadow-2xl shadow-blue-600/30 transition-transform duration-200 hover:scale-[1.02] hover:bg-blue-500"
            >
              I&apos;m Ready to Move Forward
            </button>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-center">
              <SecondaryLinkButton onClick={onEdit} className="border-none text-ink/50 hover:text-blue-600">
                Edit my roof
              </SecondaryLinkButton>
              <StartOverLink onConfirm={onStartOver} />
            </div>
          </div>
        </div>
      </RevealItem>
    </RevealGroup>
  );
}
