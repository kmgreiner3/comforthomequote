import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { PrimaryButton, SecondaryLinkButton } from './ui';
import RoofOutlineOverlay from './RoofOutlineOverlay';
import type { LatLngCorner, MapMeta } from '../../lib/mapMeta';
import {
  areaM2ToSqft,
  imagePxToLatLng,
  imagePxToMetersFromCenter,
  latLngToImagePx,
  polygonSelfIntersects,
  shoelaceAreaM2,
} from '../../lib/mercator';
import { formatFootprintSqft } from '../../lib/format';

interface Corner {
  x: number;
  y: number;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

// @chq/pricing's sqFromOutline() throws a RangeError outside (0, 20000].
// The corners are freely draggable across the whole image (which frames
// well beyond just the building footprint, per FRAMING_PADDING), so a
// dragged-out quad can genuinely reach an area outside that range --
// guard against ever calling setOutlineAdjusted with one.
const MIN_VALID_SQFT = 1;
const MAX_VALID_SQFT = 20000;

function isValidSqft(sqft: number): boolean {
  return Number.isFinite(sqft) && sqft > MIN_VALID_SQFT && sqft <= MAX_VALID_SQFT;
}

function computeSqft(corners: Corner[], mapMeta: MapMeta): number {
  const metersPoints = corners.map((c) => imagePxToMetersFromCenter(c, mapMeta));
  return areaM2ToSqft(shoelaceAreaM2(metersPoints));
}

export default function RoofOutlineEditor({
  imageUrl,
  mapMeta,
  corners: initialCorners,
  initialSqft,
  onApply,
  onCancel,
  cancelLabel = 'Cancel',
  cancelVariant = 'button',
}: {
  imageUrl: string;
  mapMeta: MapMeta;
  // Starting points for this editing session -- from the store's
  // outlineCorners (feedback round 6; expanded from 4 to 6 points in round
  // 7 -- Task C item 4), so reopening the editor after a prior adjustment
  // starts from the adjusted shape, not the original satellite bounding
  // box. Same sw -> w-mid -> nw -> ne -> e-mid -> se order as the store.
  corners: LatLngCorner[];
  // The footprint sq ft the confirm card was already showing (Solar's own
  // roof-area measurement, or a prior adjustment) -- displayed as-is until
  // the homeowner actually moves a corner. Solar's roof polygon area is
  // never equal to the bbox RECTANGLE's own shoelace area (a bounding
  // rectangle is always larger than the irregular roof it circumscribes),
  // so deriving the readout from `corners` from the very first render
  // would make the number visibly jump the instant the editor opens, before
  // the homeowner has touched anything.
  initialSqft: number;
  onApply: (sqft: number, corners: LatLngCorner[]) => void;
  onCancel: () => void;
  // The confirm-card "Adjust outline" flow keeps the default bordered
  // "Cancel" button. The no-solar-data trace flow (feedback round 7, Task C
  // item 2) reuses this same editor but wants a small, quiet text link
  // reading "Enter your home's footprint instead" instead -- manual entry
  // must never look like a peer action next to "Use this outline" there.
  cancelLabel?: string;
  cancelVariant?: 'button' | 'link';
}) {
  // Drag state lives in image-pixel space (what pointer events naturally
  // give us); lat/lng is only ever derived from it, on demand, never the
  // other way during a drag.
  const [corners, setCorners] = useState<Corner[]>(() =>
    initialCorners.map(({ lat, lng }) => latLngToImagePx(lat, lng, mapMeta))
  );
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  // Flips true the first time a corner actually moves -- see `initialSqft`.
  const [hasAdjusted, setHasAdjusted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Recomputed on every corner change -- cheap (6-point shoelace) enough
  // to run on every drag frame. This is what "Use this outline" always
  // submits, regardless of what the readout below is currently showing.
  const liveSqft = useMemo(() => computeSqft(corners, mapMeta), [corners, mapMeta]);
  // The readout itself: the stored footprint until the first drag, then the
  // live geometry -- see `initialSqft` above for why.
  const displaySqft = hasAdjusted ? liveSqft : initialSqft;
  // Feedback round 7 (Task C item 4): moving from 4 points to 6 makes it
  // possible to drag a midpoint far enough to cross one of the outline's
  // own other edges -- not a coherent roof footprint. Checked in pixel
  // space (what's actually rendered), same cadence as liveSqft.
  const selfIntersects = useMemo(() => polygonSelfIntersects(corners), [corners]);

  // For the shared overlay's polygon (and for "Use this outline"'s
  // onApply): projected back to lat/lng from the current pixel state. A
  // harmless floating-point-only round trip for rendering -- the pixel
  // state above remains the actual source of truth while dragging.
  const latLngCorners = useMemo(() => corners.map((c) => imagePxToLatLng(c, mapMeta)), [corners, mapMeta]);

  function moveCorner(index: number, clientX: number, clientY: number) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return;
    const x = clamp(((clientX - rect.left) / rect.width) * mapMeta.imgW, 0, mapMeta.imgW);
    const y = clamp(((clientY - rect.top) / rect.height) * mapMeta.imgH, 0, mapMeta.imgH);
    setHasAdjusted(true);
    setCorners((prev) => prev.map((c, i) => (i === index ? { x, y } : c)));
  }

  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>, index: number) {
    // jsdom (unit tests) doesn't implement pointer capture -- optional
    // chaining keeps this a no-op there instead of throwing, while real
    // browsers get proper capture so dragging keeps tracking the pointer
    // even once it moves outside the 28px handle.
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDraggingIndex(index);
    moveCorner(index, e.clientX, e.clientY);
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>, index: number) {
    if (draggingIndex !== index) return;
    moveCorner(index, e.clientX, e.clientY);
  }

  function handlePointerUp(e: ReactPointerEvent<HTMLDivElement>, index: number) {
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    setDraggingIndex(null);
  }

  return (
    <div className="max-w-sm">
      <RoofOutlineOverlay
        ref={containerRef}
        containerTestId="roof-outline-editor-surface"
        imageUrl={imageUrl}
        alt="Aerial view of your property. Drag the corners to match your roof."
        mapMeta={mapMeta}
        corners={latLngCorners}
        objectFit="none"
        className="w-full touch-none select-none rounded-2xl"
        imgClassName="block w-full"
      >
        {corners.map((c, i) => (
          // Outer div: the actual draggable hit target -- kept at ~28px
          // (h-7 w-7) so touch dragging stays comfortable. Inner span: the
          // ~14px (h-3.5 w-3.5) VISIBLE dot -- Kyle: the old circles (28px
          // visible) were too big once there were 6 of them crowding the
          // outline instead of 4.
          <div
            key={i}
            data-testid={`roof-outline-corner-${i}`}
            aria-label={`Roof corner handle ${i + 1}`}
            onPointerDown={(e) => handlePointerDown(e, i)}
            onPointerMove={(e) => handlePointerMove(e, i)}
            onPointerUp={(e) => handlePointerUp(e, i)}
            onPointerCancel={(e) => handlePointerUp(e, i)}
            className="absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 cursor-grab items-center justify-center"
            style={{
              left: `${(c.x / mapMeta.imgW) * 100}%`,
              top: `${(c.y / mapMeta.imgH) * 100}%`,
              touchAction: 'none',
            }}
          >
            <span
              aria-hidden="true"
              className="pointer-events-none block h-3.5 w-3.5 rounded-full border-2 border-blue-600 bg-white shadow"
            />
          </div>
        ))}
      </RoofOutlineOverlay>

      <p className="mt-3 text-sm font-medium text-navy-950" aria-live="polite" data-testid="roof-outline-live-sqft">
        About {formatFootprintSqft(displaySqft)} sq ft
      </p>
      {selfIntersects ? (
        <p className="mt-2 text-sm text-red-600">
          That outline crosses itself. Move the points so the edges do not overlap.
        </p>
      ) : (
        !isValidSqft(liveSqft) && (
          <p className="mt-2 text-sm text-red-600">
            That outline isn&apos;t a realistic footprint. Drag the corners closer to your roof.
          </p>
        )
      )}

      <div className="mt-4 flex flex-wrap gap-3">
        <PrimaryButton
          type="button"
          disabled={!isValidSqft(liveSqft) || selfIntersects}
          onClick={() => onApply(liveSqft, latLngCorners)}
        >
          Use this outline
        </PrimaryButton>
        {cancelVariant === 'link' ? (
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[44px] text-sm font-medium text-ink/60 underline-offset-2 transition-colors hover:text-blue-600 hover:underline"
          >
            {cancelLabel}
          </button>
        ) : (
          <SecondaryLinkButton type="button" onClick={onCancel}>
            {cancelLabel}
          </SecondaryLinkButton>
        )}
      </div>
    </div>
  );
}
