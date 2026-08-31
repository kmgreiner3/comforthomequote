import { useState } from 'react';
import { INCLUDED_TILES } from '../../content/included';
import { BackChevron, IncludedBadge, PrimaryButton, StepHeading } from './ui';
import { RevealGroup, RevealItem } from './motion';

// Feedback round 8, item 11: peel & stick is now standard on every quote, so
// it's the pinned first tile here -- visually distinct (amber emphasis)
// from the 12 plain white tiles below it, with its own expandable
// "Why not synthetic?" explanation. Deliberately NOT part of
// content/included.ts's INCLUDED_TILES: that array is also rendered on the
// Review step's "Included with every roof" list, which keeps its own
// separate "Peel and stick underlayment: Included" row instead (item 12).
const WHY_NOT_SYNTHETIC =
  'Synthetic underlayment is mechanically fastened with staples or nails, which means every fastener is a potential point where water can get through. Peel and stick is self-adhered directly to your decking, creating one continuous, sealed water barrier with no fastener penetrations. It is a stronger secondary layer of defense, so we install it on every roof rather than offering the lesser option.';

export default function StepIncluded({ onContinue, onBack }: { onContinue: () => void; onBack: () => void }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [whyNotSyntheticOpen, setWhyNotSyntheticOpen] = useState(false);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <RevealGroup>
      <RevealItem>
        <BackChevron onClick={onBack} />
        <StepHeading
          eyebrow="What's included"
          title="Every roof includes all of this"
          subtitle="No line items, no upsells. This is what comes with every Comfort Home Quote roof."
        />
      </RevealItem>

      <RevealItem className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-2xl border-2 border-amber-400 bg-amber-400/10 p-5 sm:col-span-2 lg:col-span-3">
          <div className="flex items-start justify-between gap-2">
            <p className="font-display text-lg font-semibold text-navy-950">Premium peel and stick underlayment</p>
            <IncludedBadge />
          </div>
          <p className="mt-1.5 text-sm text-ink/80">
            A self-adhered membrane that creates a continuous water barrier under your shingles. We install it on
            every roof we build, standard.
          </p>
          <button
            type="button"
            onClick={() => setWhyNotSyntheticOpen((v) => !v)}
            className="mt-2 text-sm font-semibold text-blue-600 hover:text-blue-500"
          >
            {whyNotSyntheticOpen ? 'Show less' : 'Why not synthetic?'}
          </button>
          {whyNotSyntheticOpen && <p className="mt-1.5 max-w-2xl text-sm text-ink/80">{WHY_NOT_SYNTHETIC}</p>}
        </div>

        {INCLUDED_TILES.map((tile) => {
          const isOpen = expanded.has(tile.id);
          return (
            <div key={tile.id} className="rounded-2xl border-2 border-navy-950/10 bg-white p-5">
              <div className="flex items-start justify-between gap-2">
                <tile.Icon className="h-7 w-7 text-blue-600" />
                <IncludedBadge />
              </div>
              <p className="mt-3 font-display text-lg font-semibold text-navy-950">{tile.title}</p>
              <p className="mt-1.5 text-sm text-ink/75">{tile.summary}</p>
              {tile.expanded && (
                <>
                  {isOpen && <p className="mt-1.5 text-sm text-ink/75">{tile.expanded}</p>}
                  <button
                    type="button"
                    onClick={() => toggle(tile.id)}
                    className="mt-2 text-sm font-semibold text-blue-600 hover:text-blue-500"
                  >
                    {isOpen ? 'Show less' : 'Learn more'}
                  </button>
                </>
              )}
            </div>
          );
        })}
      </RevealItem>

      <RevealItem>
        <PrimaryButton className="mt-8" onClick={onContinue}>
          Continue
        </PrimaryButton>
      </RevealItem>
    </RevealGroup>
  );
}
