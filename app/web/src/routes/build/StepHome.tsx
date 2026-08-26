import { useEffect, useState } from 'react';
import { useBuild } from '../../state/build';
import {
  AccuracyNotice,
  BackChevron,
  CheckMark,
  PrimaryButton,
  ProminentSecondaryButton,
  StepHeading,
} from './ui';
import { RevealGroup, RevealItem } from './motion';
import { getMeasurementAttempt, setMeasurementAttempt } from './measurementAttempt';
import { formatFootprintSqft } from '../../lib/format';
import { isLatLngCornerArray, isMapMeta, type LatLngCorner, type MapMeta } from '../../lib/mapMeta';
import { areaSqftFromLatLngCorners } from '../../lib/mercator';
import RoofOutlineEditor from './RoofOutlineEditor';
import RoofOutlineOverlay from './RoofOutlineOverlay';

const MIN_SQFT = 500;
const MAX_SQFT = 15000;

// Global Constraint: 8s timeout on the measurement fetch.
const MEASURE_TIMEOUT_MS = 8000;

type Phase =
  | { kind: 'loading' }
  // `adjusted`: whether this sqft has already been committed to the store
  // via setOutlineAdjusted (true, from the outline editor's "Use this
  // outline") vs. still-unconfirmed fresh satellite output (false) that
  // "Looks right, continue" still needs to commit via setOutlineFromSatellite.
  | { kind: 'confirm'; sqft: number; imageUrl?: string; mapMeta?: MapMeta; adjusted: boolean }
  // Entered via "Adjust outline"; sqft/adjusted here are what Cancel
  // reverts to (the confirm phase's own state at the moment of entry).
  // mapMeta/corners for the editor itself come from the store (the single
  // source of truth, feedback round 6), not from this phase.
  | { kind: 'editor'; sqft: number; imageUrl: string; adjusted: boolean }
  // Entered on a {found:false, reason:"no-solar-data"} response that still
  // came with imagery (feedback round 7, Task C item 2): there's a geocode
  // and an aerial, just no Solar building measurement, so the homeowner
  // traces the roof themselves instead of dead-ending into manual entry.
  // mapMeta/corners for the editor come from the store (set via
  // setSeedOutline the moment this phase is entered), same pattern as
  // 'editor' above.
  | { kind: 'trace'; imageUrl: string; mapMeta: MapMeta; corners: LatLngCorner[] }
  | { kind: 'form' }
  | { kind: 'outside-florida' };

// Client pricing-display rule: the satellite-measured FOOTPRINT sq ft may be
// shown, rounded for display (AUTHORIZED display exception, Kyle,
// 2026-08-25) -- see formatFootprintSqft(). Roofing squares, the x1.2
// pitched-area result, and any per-SQ pricing derived from this number must
// still never be rendered. `sqft` is passed to formatFootprintSqft() for
// display and to setOutlineFromSatellite() for the store; the store always
// keeps the exact, unrounded value for pricing.
function isFoundResponse(
  data: unknown
): data is { found: true; outlineSqft: number; imageUrl?: string; mapMeta?: MapMeta; formattedAddress?: string } {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  if (d.found !== true) return false;
  if (typeof d.outlineSqft !== 'number' || !Number.isFinite(d.outlineSqft)) return false;
  if (d.imageUrl !== undefined && typeof d.imageUrl !== 'string') return false;
  if (d.mapMeta !== undefined && !isMapMeta(d.mapMeta)) return false;
  if (d.formattedAddress !== undefined && typeof d.formattedAddress !== 'string') return false;
  return true;
}

// {found:false, reason:"outside-florida"} is the one failure mode that
// gets its own dead-end UI instead of the silent manual-entry fallback --
// we don't serve outside Florida, so there is no point asking the
// homeowner to type in a footprint by hand.
function isOutsideFloridaResponse(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return d.found === false && d.reason === 'outside-florida';
}

// {found:false, reason:"no-solar-data"} (feedback round 7, Task B item 2):
// the geocode succeeded and it's in Florida, but Solar had no building data
// at all. Still worth an aerial + a seed rectangle to trace from -- see
// hasTraceImagery below, which decides whether this response actually has
// enough to offer trace mode.
function isNoSolarDataResponse(data: unknown): data is {
  found: false;
  reason: 'no-solar-data';
  formattedAddress?: string;
  imageUrl?: string;
  mapMeta?: MapMeta;
  seedCorners?: LatLngCorner[];
} {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  if (d.found !== false || d.reason !== 'no-solar-data') return false;
  if (d.formattedAddress !== undefined && typeof d.formattedAddress !== 'string') return false;
  if (d.imageUrl !== undefined && typeof d.imageUrl !== 'string') return false;
  if (d.mapMeta !== undefined && !isMapMeta(d.mapMeta)) return false;
  if (d.seedCorners !== undefined && !isLatLngCornerArray(d.seedCorners)) return false;
  return true;
}

// Trace mode needs all three of imageUrl/mapMeta/seedCorners to actually
// render the editor -- a no-solar-data response missing any of them (e.g.
// the aerial fetch itself failed, best-effort per measure.ts) has nothing
// to trace, so it falls back to the plain manual form instead (same as any
// other "not enough to work with" response).
function hasTraceImagery(d: {
  imageUrl?: string;
  mapMeta?: MapMeta;
  seedCorners?: LatLngCorner[];
}): d is { imageUrl: string; mapMeta: MapMeta; seedCorners: LatLngCorner[] } {
  return typeof d.imageUrl === 'string' && !!d.mapMeta && Array.isArray(d.seedCorners) && d.seedCorners.length >= 3;
}

// On mount, decide the starting phase without ever re-firing a fetch that
// was already resolved for this exact address:
//  - a footprint is already set (satellite-confirmed earlier, or manual) ->
//    fall straight to the existing manual form, prefilled.
//  - we already attempted this address this session -> reuse that outcome
//    (a cached "found" restores the confirm card, a cached "outside-
//    florida" restores the error card, a cached fallback goes straight to
//    the manual form) instead of calling the API again.
//  - otherwise -> kick off the loading phase, which the effect below turns
//    into exactly one fetch.
function initialPhase(address: string | null, savedOutline: number | null): Phase {
  if (savedOutline != null) return { kind: 'form' };
  if (!address || !address.trim()) return { kind: 'form' };

  const attempt = getMeasurementAttempt();
  if (attempt && attempt.address === address) {
    if (attempt.outcome === 'found') {
      return {
        kind: 'confirm',
        sqft: attempt.sqft,
        imageUrl: attempt.imageUrl,
        mapMeta: attempt.mapMeta,
        adjusted: false,
      };
    }
    if (attempt.outcome === 'trace') {
      return { kind: 'trace', imageUrl: attempt.imageUrl, mapMeta: attempt.mapMeta, corners: attempt.seedCorners };
    }
    if (attempt.outcome === 'outside-florida') {
      return { kind: 'outside-florida' };
    }
    return { kind: 'form' };
  }
  return { kind: 'loading' };
}

export default function StepHome({ onContinue, onBack }: { onContinue: () => void; onBack: () => void }) {
  const setOutline = useBuild((s) => s.setOutline);
  const setOutlineFromSatellite = useBuild((s) => s.setOutlineFromSatellite);
  const setOutlineAdjusted = useBuild((s) => s.setOutlineAdjusted);
  const setPropertyImageUrl = useBuild((s) => s.setPropertyImageUrl);
  const propertyImageUrl = useBuild((s) => s.propertyImageUrl);
  const setMeasuredMapMeta = useBuild((s) => s.setMeasuredMapMeta);
  const setSeedOutline = useBuild((s) => s.setSeedOutline);
  const adoptCanonicalAddress = useBuild((s) => s.adoptCanonicalAddress);
  // Single source of truth for the outline quad (feedback round 6): both
  // the confirm card's read-only overlay and the adjust-outline editor
  // render from these, never from local phase state, so they can never
  // show a different rectangle than what's actually stored.
  const mapMeta = useBuild((s) => s.mapMeta);
  const outlineCorners = useBuild((s) => s.outlineCorners);
  const savedOutline = useBuild((s) => s.outlineSqft);
  const outlineSource = useBuild((s) => s.outlineSource);
  const address = useBuild((s) => s.address);
  const placeId = useBuild((s) => s.placeId);

  // Client pricing-display rule extends here: a satellite-sourced OR
  // homeowner-adjusted outline must never leak into the DOM, including as
  // a prefilled input value on back-navigation -- both are image-derived
  // measurements, not a hand-typed footprint. Only a manual-sourced saved
  // value may still prefill.
  const [value, setValue] = useState(
    savedOutline != null && outlineSource === 'manual' ? String(savedOutline) : ''
  );
  const [phase, setPhase] = useState<Phase>(() => initialPhase(address, savedOutline));
  // A presigned imageUrl can go stale (1h expiry) or the image can simply
  // fail to load; onError just hides it -- the store keeps whatever URL it
  // has, no need to know about expiry.
  const [imgFailed, setImgFailed] = useState(false);

  // Keep the store's propertyImageUrl in sync with whatever the confirm
  // phase is showing, whether that's a fresh fetch or a cached attempt
  // restored on mount -- one place, instead of duplicating the store write.
  useEffect(() => {
    if (phase.kind === 'confirm') {
      setPropertyImageUrl(phase.imageUrl ?? null);
      setMeasuredMapMeta(phase.mapMeta ?? null);
      setImgFailed(false);
    } else if (phase.kind === 'trace') {
      setPropertyImageUrl(phase.imageUrl);
      // Trusts the response's own seedCorners verbatim rather than
      // re-deriving from the mapMeta bbox (there is no real Solar bbox
      // here) -- see setSeedOutline's own doc comment in state/build.ts.
      setSeedOutline(phase.mapMeta, phase.corners);
      setImgFailed(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

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
      body: JSON.stringify({ address, ...(placeId ? { placeId } : {}) }),
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
          // The geocode's canonical formatted_address always includes the
          // ZIP, unlike a Google suggestion description -- adopt it into
          // the store now so the ZIP is present for later steps (feedback
          // round 7, Task C item 1), without disturbing placeId/outline/
          // mapMeta, which get set separately below/via the effect above.
          // The cache entry below is keyed by this SAME canonical text
          // (falling back to the address this fetch was actually sent
          // for, when the response carries none) -- keying it by the
          // pre-canonicalization text would make the at-most-once cache
          // miss on the very next mount, since by then the store's own
          // `address` (what a fresh mount's initialPhase() compares
          // against) has already moved on to the canonical text.
          const canonicalAddress = data.formattedAddress || (address as string);
          if (data.formattedAddress) adoptCanonicalAddress(data.formattedAddress);
          setMeasurementAttempt({
            address: canonicalAddress,
            outcome: 'found',
            sqft: data.outlineSqft,
            ...(data.imageUrl ? { imageUrl: data.imageUrl } : {}),
            ...(data.mapMeta ? { mapMeta: data.mapMeta } : {}),
          });
          setPhase({
            kind: 'confirm',
            sqft: data.outlineSqft,
            imageUrl: data.imageUrl,
            mapMeta: data.mapMeta,
            adjusted: false,
          });
        } else if (isOutsideFloridaResponse(data)) {
          setMeasurementAttempt({ address: address as string, outcome: 'outside-florida' });
          setPhase({ kind: 'outside-florida' });
        } else if (isNoSolarDataResponse(data) && hasTraceImagery(data)) {
          // Geocode succeeded, in Florida, but Solar had no building data --
          // trace mode replaces the old manual dead-end (feedback round 7,
          // Task C item 2) whenever there's enough imagery to trace from.
          // Same canonical-address cache-key reasoning as the found branch
          // above.
          const canonicalAddress = data.formattedAddress || (address as string);
          if (data.formattedAddress) adoptCanonicalAddress(data.formattedAddress);
          setMeasurementAttempt({
            address: canonicalAddress,
            outcome: 'trace',
            imageUrl: data.imageUrl,
            mapMeta: data.mapMeta,
            seedCorners: data.seedCorners,
          });
          setPhase({ kind: 'trace', imageUrl: data.imageUrl, mapMeta: data.mapMeta, corners: data.seedCorners });
        } else {
          // {available:false} | {found:false, reason: anything else,
          // including a no-solar-data response with no usable imagery} |
          // anything malformed
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

  function handleConfirmSatellite(sqft: number, adjusted: boolean) {
    // If the outline was already adjusted via the editor, setOutlineAdjusted
    // already committed it to the store at that moment -- committing again
    // here via setOutlineFromSatellite would wrongly overwrite
    // outlineSource back to 'satellite'.
    if (!adjusted) setOutlineFromSatellite(sqft);
    onContinue();
  }

  function handlePreferManual() {
    // No image on the manual path.
    setPropertyImageUrl(null);
    setPhase({ kind: 'form' });
  }

  function handleAdjustOutline() {
    if (phase.kind !== 'confirm' || !mapMeta || !outlineCorners || !phase.imageUrl || imgFailed) return;
    setPhase({ kind: 'editor', sqft: phase.sqft, imageUrl: phase.imageUrl, adjusted: phase.adjusted });
  }

  function handleApplyAdjustedOutline(sqft: number, corners: LatLngCorner[]) {
    if (phase.kind !== 'editor') return;
    setOutlineAdjusted(sqft, corners);
    setPhase({ kind: 'confirm', sqft, imageUrl: phase.imageUrl, mapMeta: mapMeta ?? undefined, adjusted: true });
  }

  function handleCancelAdjustOutline() {
    if (phase.kind !== 'editor') return;
    setPhase({ kind: 'confirm', sqft: phase.sqft, imageUrl: phase.imageUrl, mapMeta: mapMeta ?? undefined, adjusted: phase.adjusted });
  }

  // Trace mode's "Use this outline": there is no prior confirm phase to
  // return to (found:false skipped it entirely) -- the traced footprint IS
  // the confirmed measurement, tagged 'adjusted' same as any other
  // homeowner-drawn outline (feedback round 7, Task C item 2).
  function handleApplyTrace(sqft: number, corners: LatLngCorner[]) {
    setOutlineAdjusted(sqft, corners);
    onContinue();
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

  if (phase.kind === 'outside-florida') {
    return (
      <RevealGroup>
        <RevealItem>
          <BackChevron onClick={onBack} />
        </RevealItem>
        <RevealItem>
          <div className="max-w-sm rounded-2xl border-2 border-red-200 bg-red-50 p-5">
            <p className="font-display text-lg font-semibold text-navy-950">
              That address is outside Florida.
            </p>
            <p className="mt-1.5 text-sm text-ink/70">
              We currently serve Florida homes only. Check the address and try again.
            </p>
            <PrimaryButton className="mt-4" onClick={onBack}>
              Fix my address
            </PrimaryButton>
          </div>
        </RevealItem>
      </RevealGroup>
    );
  }

  if (phase.kind === 'editor') {
    return (
      <RevealGroup>
        <RevealItem>
          <BackChevron onClick={handleCancelAdjustOutline} />
          <StepHeading
            eyebrow="Your home"
            title="Adjust the roof outline"
            subtitle="Drag the corners so the outline matches your roof."
          />
        </RevealItem>

        {mapMeta && outlineCorners && (
          <RevealItem>
            <RoofOutlineEditor
              imageUrl={phase.imageUrl}
              mapMeta={mapMeta}
              corners={outlineCorners}
              initialSqft={phase.sqft}
              onApply={handleApplyAdjustedOutline}
              onCancel={handleCancelAdjustOutline}
            />
          </RevealItem>
        )}
      </RevealGroup>
    );
  }

  if (phase.kind === 'trace') {
    return (
      <RevealGroup>
        <RevealItem>
          <BackChevron onClick={onBack} />
          <StepHeading
            eyebrow="Your home"
            title="Draw your roof outline"
            subtitle="We could not measure this roof automatically. Drag the points so the outline covers your roof."
          />
        </RevealItem>

        {mapMeta && outlineCorners && (
          <RevealItem>
            <RoofOutlineEditor
              imageUrl={phase.imageUrl}
              mapMeta={mapMeta}
              corners={outlineCorners}
              initialSqft={areaSqftFromLatLngCorners(outlineCorners, mapMeta)}
              onApply={handleApplyTrace}
              onCancel={handlePreferManual}
              cancelLabel="Enter your home's footprint instead"
              cancelVariant="link"
            />
          </RevealItem>
        )}
      </RevealGroup>
    );
  }

  if (phase.kind === 'confirm') {
    const canAdjustOutline = Boolean(mapMeta) && Boolean(outlineCorners) && Boolean(phase.imageUrl) && !imgFailed;
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

        {propertyImageUrl && !imgFailed && (
          <RevealItem>
            {mapMeta && outlineCorners ? (
              <RoofOutlineOverlay
                imageUrl={propertyImageUrl}
                alt="Aerial view with your roof outlined"
                mapMeta={mapMeta}
                corners={outlineCorners}
                objectFit="cover"
                className="max-h-[260px] w-full max-w-sm rounded-2xl"
                style={{ aspectRatio: `${mapMeta.imgW} / ${mapMeta.imgH}` }}
                imgClassName="block h-full w-full object-cover"
                onImgError={() => setImgFailed(true)}
              />
            ) : (
              // Older persisted state (or a measurement with no bounding
              // box) has no mapMeta/corners to draw an overlay from --
              // render the plain aerial photo instead of crashing.
              <img
                src={propertyImageUrl}
                alt="Aerial view with your roof outlined"
                className="max-h-[260px] w-full max-w-sm rounded-2xl object-cover"
                onError={() => setImgFailed(true)}
              />
            )}
          </RevealItem>
        )}

        <RevealItem>
          <div className="flex max-w-sm items-start gap-3 rounded-xl bg-white p-4">
            <CheckMark className="mt-0.5 h-6 w-6 shrink-0 text-blue-600" />
            <div>
              <p className="font-display text-lg font-medium text-navy-950">We found your roof.</p>
              <p className="mt-1 text-sm text-ink/70">
                Roof footprint: about {formatFootprintSqft(phase.sqft)} sq ft, measured from the outlined
                building.
              </p>
            </div>
          </div>
        </RevealItem>

        <RevealItem>
          <AccuracyNotice className="mt-4 max-w-sm" />
        </RevealItem>

        {canAdjustOutline && (
          <RevealItem>
            <p className="mt-6 max-w-sm text-sm text-ink/70">
              Outline not covering your whole roof? <span className="font-semibold text-navy-950">Adjust it.</span>
            </p>
          </RevealItem>
        )}

        <RevealItem>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <PrimaryButton onClick={() => handleConfirmSatellite(phase.sqft, phase.adjusted)}>
              Looks right, continue
            </PrimaryButton>
            {canAdjustOutline && (
              <ProminentSecondaryButton type="button" onClick={handleAdjustOutline}>
                Adjust outline
              </ProminentSecondaryButton>
            )}
          </div>
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
