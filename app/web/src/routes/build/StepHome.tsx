import { useState } from 'react';
import { useBuild } from '../../state/build';
import { BackChevron, CheckMark, PrimaryButton, StepHeading } from './ui';
import { RevealGroup, RevealItem } from './motion';

const MIN_SQFT = 500;
const MAX_SQFT = 15000;

export default function StepHome({ onContinue, onBack }: { onContinue: () => void; onBack: () => void }) {
  const setOutline = useBuild((s) => s.setOutline);
  const savedOutline = useBuild((s) => s.outlineSqft);
  const [value, setValue] = useState(savedOutline != null ? String(savedOutline) : '');

  const numeric = Number(value);
  const isValid = value.trim() !== '' && Number.isFinite(numeric) && numeric >= MIN_SQFT && numeric <= MAX_SQFT;
  const showRangeError = value.trim() !== '' && !isValid;

  function handleContinue() {
    if (!isValid) return;
    setOutline(numeric);
    onContinue();
  }

  return (
    <RevealGroup>
      <RevealItem>
        <BackChevron onClick={onBack} />
        <StepHeading
          eyebrow="Your home"
          title="Confirm your home's size"
          subtitle="You can find your home's footprint on your county property appraiser's site."
        />
      </RevealItem>

      <RevealItem>
        <div className="max-w-sm">
          <label htmlFor="footprint" className="text-sm font-medium text-ink/70">
            Home footprint (sq ft)
          </label>
          <input
            id="footprint"
            name="footprint"
            type="number"
            inputMode="numeric"
            min={MIN_SQFT}
            max={MAX_SQFT}
            placeholder="2,000"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="mt-2 min-h-[44px] w-full appearance-none rounded-xl border-2 border-navy-950/15 bg-white px-5 py-4 text-lg tabular-nums text-ink outline-none transition-colors [appearance:textfield] focus:border-blue-600 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          {showRangeError && (
            <p className="mt-2 text-sm text-red-600">Enter a footprint between 500 and 15,000 sq ft.</p>
          )}
        </div>
      </RevealItem>

      {isValid && (
        <RevealItem>
          <div className="mt-6 flex max-w-sm items-center gap-3 rounded-xl bg-white p-4">
            <CheckMark className="h-6 w-6 shrink-0 text-blue-600" />
            <p className="font-display text-lg font-medium text-navy-950">
              Got it. We&apos;ve sized your roof.
            </p>
          </div>
        </RevealItem>
      )}

      <RevealItem>
        <PrimaryButton className="mt-8" disabled={!isValid} onClick={handleContinue}>
          Continue
        </PrimaryButton>
      </RevealItem>
    </RevealGroup>
  );
}
