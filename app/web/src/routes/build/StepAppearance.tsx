import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { SHINGLES } from '@chq/pricing';
import { useBuild, type DripEdge } from '../../state/build';
import { colorInfo, SWATCH_NOTE } from '../../content/colorInfo';
import { BackChevron, CheckMark, PrimaryButton, SelectionCard, StepHeading } from './ui';
import { RevealGroup, RevealItem, useIsDesktop } from './motion';
import VisualizerPanel from './VisualizerPanel';

const DRIP_EDGE_OPTIONS: { value: DripEdge; hex: string }[] = [
  { value: 'White', hex: '#f4f4f2' },
  { value: 'Black', hex: '#26262a' },
  { value: 'Brown', hex: '#5a4636' },
];

function ColorSwatchButton({
  name,
  selected,
  onSelect,
}: {
  name: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const info = colorInfo(name);
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`min-h-[44px] rounded-2xl border-2 p-3 text-left transition-colors duration-200 ${
        selected ? 'border-blue-600 bg-blue-600/5' : 'border-navy-950/15 bg-white hover:border-blue-600/50'
      }`}
    >
      <span className="relative block aspect-square w-full overflow-hidden rounded-xl bg-sky-50">
        {info && <img src={info.image} alt="" className="h-full w-full object-cover" />}
        {selected && <CheckMark className="absolute right-1.5 top-1.5 h-6 w-6 text-blue-600 drop-shadow" />}
      </span>
      <span className="mt-2 block text-sm font-medium text-ink">{name}</span>
    </button>
  );
}

function ColorDescriptionPanel({ color }: { color: string | null }) {
  const reduce = Boolean(useReducedMotion());
  const info = color ? colorInfo(color) : undefined;

  return (
    <div
      data-testid="color-description"
      className="min-h-[7rem] rounded-2xl border-2 border-navy-950/10 bg-white p-6"
    >
      {info && color ? (
        reduce ? (
          <div>
            <p data-testid="color-description-name" className="font-display text-lg font-semibold text-navy-950">
              {color}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-ink/80">{info.description}</p>
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
              <p className="mt-2 text-sm leading-relaxed text-ink/80">{info.description}</p>
            </motion.div>
          </AnimatePresence>
        )
      ) : (
        <p className="text-sm text-ink/50">Pick a color above to see details.</p>
      )}
      <p className="mt-4 text-xs text-ink/50">{SWATCH_NOTE}</p>
    </div>
  );
}

export default function StepAppearance({ onContinue, onBack }: { onContinue: () => void; onBack: () => void }) {
  const shingle = useBuild((s) => s.shingle);
  const color = useBuild((s) => s.color);
  const setColor = useBuild((s) => s.setColor);
  const dripEdge = useBuild((s) => s.dripEdge);
  const setDripEdge = useBuild((s) => s.setDripEdge);
  const isDesktop = useIsDesktop();

  if (shingle == null) return null; // shouldn't render: gated behind a shingle choice

  const product = SHINGLES[shingle];

  return (
    <RevealGroup>
      <RevealItem>
        <BackChevron onClick={onBack} />
        <StepHeading
          eyebrow={product.name}
          title="Choose your color and finish"
          subtitle="Every color below is available on your selected shingle."
        />
      </RevealItem>

      <RevealItem>
        <div className="mb-8">
          <VisualizerPanel product={shingle} />
        </div>
      </RevealItem>

      <RevealItem>
        {isDesktop ? (
          <div className="grid grid-cols-[1fr_320px] items-start gap-8">
            <div className="grid grid-cols-3 gap-4 lg:grid-cols-4">
              {product.colors.map((name) => (
                <ColorSwatchButton key={name} name={name} selected={color === name} onSelect={() => setColor(name)} />
              ))}
            </div>
            <div className="sticky top-24">
              <ColorDescriptionPanel color={color} />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {product.colors.map((name) => (
              <div key={name} className="contents">
                <ColorSwatchButton name={name} selected={color === name} onSelect={() => setColor(name)} />
                {color === name && (
                  <div className="col-span-full">
                    <ColorDescriptionPanel color={name} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </RevealItem>

      <RevealItem>
        <div className="mt-10">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Drip edge</p>
          <p className="mt-1 text-sm text-ink/70">
            Drip edge directs water away from your decking and fascia along the roof&apos;s edge.
          </p>
          <div className="mt-4 grid grid-cols-3 gap-4 sm:max-w-lg">
            {DRIP_EDGE_OPTIONS.map(({ value, hex }) => (
              <SelectionCard key={value} selected={dripEdge === value} onSelect={() => setDripEdge(value)} className="p-4">
                <span className="block h-14 w-full rounded-xl border border-navy-950/10" style={{ backgroundColor: hex }} />
                <span className="mt-3 block text-center text-sm font-semibold">{value}</span>
              </SelectionCard>
            ))}
          </div>
        </div>
      </RevealItem>

      <RevealItem>
        <PrimaryButton className="mt-8" disabled={color == null || dripEdge == null} onClick={onContinue}>
          Continue
        </PrimaryButton>
      </RevealItem>
    </RevealGroup>
  );
}
