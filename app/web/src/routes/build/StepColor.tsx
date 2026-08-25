import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { SHINGLES } from '@chq/pricing';
import { useBuild } from '../../state/build';
import { colorInfo, SWATCH_NOTE } from '../../content/colorInfo';
import { BackChevron, CheckMark, StepHeading } from './ui';
import { RevealGroup, RevealItem } from './motion';
import { useDelayedContinue } from './useDelayedContinue';

export default function StepColor({ onContinue, onBack }: { onContinue: () => void; onBack: () => void }) {
  const shingle = useBuild((s) => s.shingle);
  const color = useBuild((s) => s.color);
  const setColor = useBuild((s) => s.setColor);
  const advance = useDelayedContinue(onContinue);
  const reduce = Boolean(useReducedMotion());

  if (shingle == null) return null; // shouldn't render: gated behind a shingle choice

  const product = SHINGLES[shingle];
  const selectedInfo = color ? colorInfo(color) : undefined;

  function select(name: string) {
    setColor(name);
    advance();
  }

  return (
    <RevealGroup>
      <RevealItem>
        <BackChevron onClick={onBack} />
        <StepHeading
          eyebrow={product.name}
          title="Pick your color"
          subtitle="Every color below is available on your selected shingle."
        />
      </RevealItem>

      <RevealItem className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {product.colors.map((name) => {
          const selected = color === name;
          const info = colorInfo(name);
          return (
            <button
              key={name}
              type="button"
              onClick={() => select(name)}
              aria-pressed={selected}
              className={`min-h-[44px] rounded-2xl border-2 p-3 text-left transition-colors duration-200 ${
                selected ? 'border-blue-600 bg-blue-600/5' : 'border-navy-950/15 bg-white hover:border-blue-600/50'
              }`}
            >
              <span className="relative block aspect-square w-full overflow-hidden rounded-xl bg-sky-50">
                {info && <img src={info.image} alt="" className="h-full w-full object-cover" />}
                {selected && (
                  <CheckMark className="absolute right-1.5 top-1.5 h-6 w-6 text-blue-600 drop-shadow" />
                )}
              </span>
              <span className="mt-2 block text-sm font-medium text-ink">{name}</span>
            </button>
          );
        })}
      </RevealItem>

      <RevealItem>
        <div data-testid="color-description" className="mt-6 min-h-[7rem] rounded-2xl border-2 border-navy-950/10 bg-white p-6">
          {selectedInfo && color ? (
            reduce ? (
              <div>
                <p data-testid="color-description-name" className="font-display text-lg font-semibold text-navy-950">
                  {color}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-ink/80">{selectedInfo.description}</p>
              </div>
            ) : (
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={color}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <p data-testid="color-description-name" className="font-display text-lg font-semibold text-navy-950">
                    {color}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-ink/80">{selectedInfo.description}</p>
                </motion.div>
              </AnimatePresence>
            )
          ) : (
            <p className="text-sm text-ink/50">Pick a color above to see details.</p>
          )}
          <p className="mt-4 text-xs text-ink/50">{SWATCH_NOTE}</p>
        </div>
      </RevealItem>
    </RevealGroup>
  );
}
