import { SHINGLES } from '@chq/pricing';
import { useBuild } from '../../state/build';
import { swatchHex, SWATCH_NOTE } from '../../content/swatches';
import { BackChevron, CheckMark, StepHeading } from './ui';
import { RevealGroup, RevealItem } from './motion';
import { useDelayedContinue } from './useDelayedContinue';

export default function StepColor({ onContinue, onBack }: { onContinue: () => void; onBack: () => void }) {
  const shingle = useBuild((s) => s.shingle);
  const color = useBuild((s) => s.color);
  const setColor = useBuild((s) => s.setColor);
  const advance = useDelayedContinue(onContinue);

  if (shingle == null) return null; // shouldn't render: gated behind a shingle choice

  const product = SHINGLES[shingle];

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
              <span
                className="relative block aspect-square w-full rounded-xl"
                style={{ backgroundColor: swatchHex(name) }}
              >
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
        <p className="mt-6 text-xs text-ink/50">{SWATCH_NOTE}</p>
      </RevealItem>
    </RevealGroup>
  );
}
