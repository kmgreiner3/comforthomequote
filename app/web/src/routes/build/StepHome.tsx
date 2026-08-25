import { useEffect, useState } from 'react';
import { useBuild } from '../../state/build';
import { BackChevron, CheckMark, PrimaryButton, StepHeading } from './ui';
import { RevealGroup, RevealItem } from './motion';
import { getMeasurementAttempt, setMeasurementAttempt } from './measurementAttempt';

const MIN_SQFT = 500;
const MAX_SQFT = 15000;

// Global Constraint: 8s timeout on the measurement fetch.
const MEASURE_TIMEOUT_MS = 8000;

type Phase = { kind: 'loading' } | { kind: 'confirm'; sqft: number } | { kind: 'form' };

// Client pricing-display rule: never render areas/sq ft/squares derived from
// the satellite path. `sqft` here is only ever used to call
// setOutlineFromSatellite() -- it must never be interpolated into JSX.
function isFoundResponse(data: unknown): data is { found: true; outlineSqft: number } {
  return (
    !!data &&
    typeof data === 'object' &&
    (data as Record<string, unknown>).found === true &&
    typeof (data as Record<string, unknown>).outlineSqft === 'number' &&
    Number.isFinite((data as Record<string, unknown>).outlineSqft as number)
  );
}

// On mount, decide the starting phase without ever re-firing a fetch that
// was already resolved for this exact address:
//  - a footprint is already set (satellite-confirmed earlier, or manual) ->
//    fall straight to the existing manual form, prefilled.
//  - we already attempted this address this session -> reuse that outcome
//    (a cached "found" restores the confirm card; a cached fallback goes
//    straight to the manual form) instead of calling the API again.
//  - otherwise -> kick off the loading phase, which the effect below turns
//    into exactly one fetch.
function initialPhase(address: string | null, savedOutline: number | null): Phase {
  if (savedOutline != null) return { kind: 'form' };
  if (!address || !address.trim()) return { kind: 'form' };

  const attempt = getMeasurementAttempt();
  if (attempt && attempt.address === address) {
    return attempt.outcome === 'found' ? { kind: 'confirm', sqft: attempt.sqft } : { kind: 'form' };
  }
  return { kind: 'loading' };
}

export default function StepHome({ onContinue, onBack }: { onContinue: () => void; onBack: () => void }) {
  const setOutline = useBuild((s) => s.setOutline);
  const setOutlineFromSatellite = useBuild((s) => s.setOutlineFromSatellite);
  const savedOutline = useBuild((s) => s.outlineSqft);
  const outlineSource = useBuild((s) => s.outlineSource);
  const address = useBuild((s) => s.address);

  // Client pricing-display rule extends here: a satellite-sourced outline
  // must never leak into the DOM, including as a prefilled input value on
  // back-navigation. Manual-sourced saved values may still prefill.
  const [value, setValue] = useState(
    savedOutline != null && outlineSource !== 'satellite' ? String(savedOutline) : ''
  );
  const [phase, setPhase] = useState<Phase>(() => initialPhase(address, savedOutline));

  useEffect(() => {
    if (phase.kind !== 'loading') return;
    if (!address || !address.trim()) {
      setPhase({ kind: 'form' });
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), MEASURE_TIMEOUT_MS);

    function fallback() {
      if (cancelled) return;
      setMeasurementAttempt({ address: address as string, outcome: 'fallback' });
      setPhase({ kind: 'form' });
    }

    fetch('/api/measure', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address }),
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          fallback();
          return;
        }
        let data: unknown;
        try {
          data = await res.json();
        } catch {
          fallback();
          return;
        }
        if (cancelled) return;
        if (isFoundResponse(data)) {
          setMeasurementAttempt({ address: address as string, outcome: 'found', sqft: data.outlineSqft });
          setPhase({ kind: 'confirm', sqft: data.outlineSqft });
        } else {
          // {available:false} | {found:false, reason} | anything malformed
          fallback();
        }
      })
      .catch(() => {
        // Network error, abort/timeout, or anything else fetch can throw.
        fallback();
      })
      .finally(() => {
        window.clearTimeout(timeoutId);
      });

    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase.kind, address]);

  const numeric = Number(value);
  const isValid = value.trim() !== '' && Number.isFinite(numeric) && numeric >= MIN_SQFT && numeric <= MAX_SQFT;
  const showRangeError = value.trim() !== '' && !isValid;

  function handleContinue() {
    if (!isValid) return;
    setOutline(numeric);
    onContinue();
  }

  function handleConfirmSatellite(sqft: number) {
    setOutlineFromSatellite(sqft);
    onContinue();
  }

  function handlePreferManual() {
    setPhase({ kind: 'form' });
  }

  if (phase.kind === 'loading') {
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
          <div
            className="flex max-w-sm items-center gap-3 rounded-xl bg-white p-4"
            role="status"
            aria-live="polite"
          >
            <span className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-blue-600/30 border-t-blue-600" />
            <p className="text-base text-ink/70">Sizing your roof from satellite imagery...</p>
          </div>
        </RevealItem>
      </RevealGroup>
    );
  }

  if (phase.kind === 'confirm') {
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
          <div className="flex max-w-sm items-center gap-3 rounded-xl bg-white p-4">
            <CheckMark className="h-6 w-6 shrink-0 text-blue-600" />
            <p className="font-display text-lg font-medium text-navy-950">
              We sized your roof from satellite imagery.
            </p>
          </div>
        </RevealItem>

        <RevealItem>
          <PrimaryButton className="mt-8" onClick={() => handleConfirmSatellite(phase.sqft)}>
            Looks right, continue
          </PrimaryButton>
        </RevealItem>

        <RevealItem>
          <button
            type="button"
            onClick={handlePreferManual}
            className="mt-4 min-h-[44px] text-sm font-medium text-ink/60 underline-offset-2 transition-colors hover:text-blue-600 hover:underline"
          >
            Prefer to enter your home&apos;s footprint? Enter it manually.
          </button>
        </RevealItem>
      </RevealGroup>
    );
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
