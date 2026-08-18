import { useState } from 'react';
import { INCLUDED_TILES } from '../../content/included';
import { BackChevron, IncludedBadge, PrimaryButton, StepHeading } from './ui';
import { RevealGroup, RevealItem } from './motion';

export default function StepIncluded({ onContinue, onBack }: { onContinue: () => void; onBack: () => void }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

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
