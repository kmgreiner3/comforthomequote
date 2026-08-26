import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import RoofOutlineOverlay from './RoofOutlineOverlay';
import type { MapMeta } from '../../lib/mapMeta';
import { latLngToImagePx } from '../../lib/mercator';

afterEach(() => {
  cleanup();
});

// Same real captured mapMeta used by RoofOutlineEditor.test.tsx and
// StepHome.test.tsx (feedback5a-report.md) -- an internally-consistent
// center/zoom/bbox combination, not an arbitrary hand-picked one.
const MAP_META: MapMeta = {
  centerLat: 27.336230049999998,
  centerLng: -82.539976,
  zoom: 20,
  sw: { lat: 27.3360897, lng: -82.5400199 },
  ne: { lat: 27.3363704, lng: -82.5399321 },
  imgW: 1280,
  imgH: 800,
};

// sw -> nw -> ne -> se, matching the store's outlineCorners ordering.
const BBOX_CORNERS = [
  { lat: MAP_META.sw.lat, lng: MAP_META.sw.lng },
  { lat: MAP_META.ne.lat, lng: MAP_META.sw.lng },
  { lat: MAP_META.ne.lat, lng: MAP_META.ne.lng },
  { lat: MAP_META.sw.lat, lng: MAP_META.ne.lng },
];

function expectedPointsAttr(corners: typeof BBOX_CORNERS, meta: MapMeta): string {
  return corners
    .map(({ lat, lng }) => latLngToImagePx(lat, lng, meta))
    .map((p) => `${p.x},${p.y}`)
    .join(' ');
}

describe('RoofOutlineOverlay', () => {
  it('golden: the viewBox is exactly mapMeta.imgW x imgH', () => {
    const { container } = render(
      <RoofOutlineOverlay imageUrl="aerial.png" alt="Aerial view" mapMeta={MAP_META} corners={BBOX_CORNERS} />
    );
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('viewBox')).toBe(`0 0 ${MAP_META.imgW} ${MAP_META.imgH}`);
  });

  it('golden: the polygon points attribute matches the corners projected via the shared mercator math', () => {
    const { container } = render(
      <RoofOutlineOverlay imageUrl="aerial.png" alt="Aerial view" mapMeta={MAP_META} corners={BBOX_CORNERS} />
    );
    const polygon = container.querySelector('polygon');
    expect(polygon?.getAttribute('points')).toBe(expectedPointsAttr(BBOX_CORNERS, MAP_META));
  });

  it('re-renders with new points when the corners prop changes (e.g. after an adjustment)', () => {
    const { container, rerender } = render(
      <RoofOutlineOverlay imageUrl="aerial.png" alt="Aerial view" mapMeta={MAP_META} corners={BBOX_CORNERS} />
    );
    const initialPoints = container.querySelector('polygon')?.getAttribute('points');

    const adjusted = BBOX_CORNERS.map((c) => ({ lat: c.lat + 0.00002, lng: c.lng }));
    rerender(
      <RoofOutlineOverlay imageUrl="aerial.png" alt="Aerial view" mapMeta={MAP_META} corners={adjusted} />
    );
    const adjustedPoints = container.querySelector('polygon')?.getAttribute('points');

    expect(adjustedPoints).not.toBe(initialPoints);
    expect(adjustedPoints).toBe(expectedPointsAttr(adjusted, MAP_META));
  });

  it('always includes "relative" and "overflow-hidden" on the container, merged with a caller className that omits them (feedback round 6)', () => {
    const { container } = render(
      <RoofOutlineOverlay
        imageUrl="aerial.png"
        alt="Aerial view"
        mapMeta={MAP_META}
        corners={BBOX_CORNERS}
        className="w-64 rounded-2xl"
      />
    );
    const div = container.querySelector('div');
    // A caller can never silently drop `relative` (load-bearing: the svg
    // overlay is absolutely positioned against this box) just by passing a
    // className that doesn't mention it.
    expect(div?.className).toContain('relative');
    expect(div?.className).toContain('overflow-hidden');
    // The caller's own classes are still applied, not replaced.
    expect(div?.className).toContain('w-64');
    expect(div?.className).toContain('rounded-2xl');
  });

  it('falls back to a default w-full when no className is given, still merged with the base classes', () => {
    const { container } = render(
      <RoofOutlineOverlay imageUrl="aerial.png" alt="Aerial view" mapMeta={MAP_META} corners={BBOX_CORNERS} />
    );
    const div = container.querySelector('div');
    expect(div?.className).toContain('relative');
    expect(div?.className).toContain('overflow-hidden');
    expect(div?.className).toContain('w-full');
  });

  it('defaults to object-cover framing ("xMidYMid slice") for the read-only confirm-card use', () => {
    const { container } = render(
      <RoofOutlineOverlay imageUrl="aerial.png" alt="Aerial view" mapMeta={MAP_META} corners={BBOX_CORNERS} />
    );
    expect(container.querySelector('svg')?.getAttribute('preserveAspectRatio')).toBe('xMidYMid slice');
  });

  it('uses "none" preserveAspectRatio when objectFit="none" (the editor use, whose <img> is never cropped)', () => {
    const { container } = render(
      <RoofOutlineOverlay
        imageUrl="aerial.png"
        alt="Aerial view"
        mapMeta={MAP_META}
        corners={BBOX_CORNERS}
        objectFit="none"
      />
    );
    expect(container.querySelector('svg')?.getAttribute('preserveAspectRatio')).toBe('none');
  });

  it('renders the img with the given src/alt and forwards onImgError', () => {
    const onImgError = vi.fn();
    const { getByAltText } = render(
      <RoofOutlineOverlay
        imageUrl="https://example.com/aerial.png"
        alt="Aerial view with your roof outlined"
        mapMeta={MAP_META}
        corners={BBOX_CORNERS}
        onImgError={onImgError}
      />
    );
    const img = getByAltText('Aerial view with your roof outlined') as HTMLImageElement;
    expect(img.src).toBe('https://example.com/aerial.png');
    img.dispatchEvent(new Event('error', { bubbles: true }));
    expect(onImgError).toHaveBeenCalledTimes(1);
  });

  it('renders children (e.g. the editor draggable handles) inside the same positioned container', () => {
    const { getByTestId } = render(
      <RoofOutlineOverlay imageUrl="aerial.png" alt="Aerial view" mapMeta={MAP_META} corners={BBOX_CORNERS}>
        <div data-testid="handle-child" />
      </RoofOutlineOverlay>
    );
    expect(getByTestId('handle-child')).toBeTruthy();
  });

  it('forwards a ref to the container div (so callers can read its bounding box, e.g. for drag math)', () => {
    let el: HTMLDivElement | null = null;
    render(
      <RoofOutlineOverlay
        ref={(node) => {
          el = node;
        }}
        imageUrl="aerial.png"
        alt="Aerial view"
        mapMeta={MAP_META}
        corners={BBOX_CORNERS}
      />
    );
    expect(el).toBeInstanceOf(HTMLDivElement);
  });
});
