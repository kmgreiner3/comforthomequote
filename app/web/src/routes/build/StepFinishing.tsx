import { useBuild, type DripEdge } from '../../state/build';
import { BackChevron, SelectionCard, StepHeading } from './ui';
import { RevealGroup, RevealItem } from './motion';
import { useDelayedContinue } from './useDelayedContinue';

const DRIP_EDGE_OPTIONS: { value: DripEdge; hex: string }[] = [
  { value: 'White', hex: '#f4f4f2' },
  { value: 'Black', hex: '#26262a' },
  { value: 'Brown', hex: '#5a4636' },
];

export default function StepFinishing({ onContinue, onBack }: { onContinue: () => void; onBack: () => void }) {
  const dripEdge = useBuild((s) => s.dripEdge);
  const setDripEdge = useBuild((s) => s.setDripEdge);
  const advance = useDelayedContinue(onContinue);

  function select(value: DripEdge) {
    setDripEdge(value);
    advance();
  }

  return (
    <RevealGroup>
      <RevealItem>
        <BackChevron onClick={onBack} />
        <StepHeading
          eyebrow="Finishing details"
          title="Choose your drip edge color"
          subtitle="Drip edge directs water away from your decking and fascia along the roof's edge."
        />
      </RevealItem>

      <RevealItem className="grid grid-cols-3 gap-4 sm:max-w-lg">
        {DRIP_EDGE_OPTIONS.map(({ value, hex }) => (
          <SelectionCard key={value} selected={dripEdge === value} onSelect={() => select(value)} className="p-4">
            <span
              className="block h-14 w-full rounded-xl border border-navy-950/10"
              style={{ backgroundColor: hex }}
            />
            <span className="mt-3 block text-center text-sm font-semibold">{value}</span>
          </SelectionCard>
        ))}
      </RevealItem>
    </RevealGroup>
  );
}
