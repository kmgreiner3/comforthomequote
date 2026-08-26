import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { PrimaryButton, SecondaryLinkButton } from './ui';
import type { MapMeta } from '../../lib/mapMeta';
import { areaM2ToSqft, imagePxToMetersFromCenter, latLngToImagePx, shoelaceAreaM2 } from '../../lib/mercator';
import { formatFootprintSqft } from '../../lib/format';

interface Corner {
  x: number;
  y: number;
}

// Rectangle corners in the same drawing order app/api's boundingBoxPathPoints
// uses (sw -> nw -> ne -> se), projected to image px via the same Web
// Mercator math the static map image itself was rendered with.
function initialCorners(mapMeta: MapMeta): Corner[] {
  const { sw, ne } = mapMeta;
  return [
    { lat: sw.lat, lng: sw.lng },
    { lat: ne.lat, lng: sw.lng },
    { lat: ne.lat, lng: ne.lng },
    { lat: sw.lat, lng: ne.lng },
  ].map(({ lat, lng }) => latLngToImagePx(lat, lng, mapMeta));
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
  onApply,
  onCancel,
}: {
  imageUrl: string;
  mapMeta: MapMeta;
  onApply: (sqft: number) => void;
  onCancel: () => void;
}) {
  const [corners, setCorners] = useState<Corner[]>(() => initialCorners(mapMeta));
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Recomputed on every corner change -- cheap (4-point shoelace) enough
  // to run on every drag frame, giving the "about N sq ft" readout below a
  // live update while dragging.
  const liveSqft = useMemo(() => computeSqft(corners, mapMeta), [corners, mapMeta]);

  function moveCorner(index: number, clientX: number, clientY: number) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return;
    const x = clamp(((clientX - rect.left) / rect.width) * mapMeta.imgW, 0, mapMeta.imgW);
    const y = clamp(((clientY - rect.top) / rect.height) * mapMeta.imgH, 0, mapMeta.imgH);
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

  const points = corners.map((c) => `${c.x},${c.y}`).join(' ');

  return (
    <div className="max-w-sm">
      <div
        ref={containerRef}
        data-testid="roof-outline-editor-surface"
        className="relative w-full touch-none select-none overflow-hidden rounded-2xl"
        style={{ touchAction: 'none' }}
      >
        <img
          src={imageUrl}
          alt="Aerial view of your property. Drag the corners to match your roof."
          className="block w-full"
          draggable={false}
        />
        <svg
          viewBox={`0 0 ${mapMeta.imgW} ${mapMeta.imgH}`}
          preserveAspectRatio="none"
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full"
        >
          <polygon points={points} className="fill-blue-600/20 stroke-blue-600" strokeWidth={6} />
        </svg>
        {corners.map((c, i) => (
          <div
            key={i}
            data-testid={`roof-outline-corner-${i}`}
            aria-label={`Roof corner handle ${i + 1}`}
            onPointerDown={(e) => handlePointerDown(e, i)}
            onPointerMove={(e) => handlePointerMove(e, i)}
            onPointerUp={(e) => handlePointerUp(e, i)}
            onPointerCancel={(e) => handlePointerUp(e, i)}
            className="absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 cursor-grab items-center justify-center rounded-full border-2 border-blue-600 bg-white shadow"
            style={{
              left: `${(c.x / mapMeta.imgW) * 100}%`,
              top: `${(c.y / mapMeta.imgH) * 100}%`,
              touchAction: 'none',
            }}
          />
        ))}
      </div>

      <p className="mt-3 text-sm font-medium text-navy-950" aria-live="polite" data-testid="roof-outline-live-sqft">
        About {formatFootprintSqft(liveSqft)} sq ft
      </p>
      {!isValidSqft(liveSqft) && (
        <p className="mt-2 text-sm text-red-600">
          That outline isn&apos;t a realistic footprint. Drag the corners closer to your roof.
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-3">
        <PrimaryButton type="button" disabled={!isValidSqft(liveSqft)} onClick={() => onApply(liveSqft)}>
          Use this outline
        </PrimaryButton>
        <SecondaryLinkButton type="button" onClick={onCancel}>
          Cancel
        </SecondaryLinkButton>
      </div>
    </div>
  );
}
