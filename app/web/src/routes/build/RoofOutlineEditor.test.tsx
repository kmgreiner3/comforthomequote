import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import RoofOutlineEditor from './RoofOutlineEditor';
import type { MapMeta } from '../../lib/mapMeta';
import {
  areaM2ToSqft,
  imagePxToMetersFromCenter,
  latLngToImagePx,
  shoelaceAreaM2,
} from '../../lib/mercator';
import { formatFootprintSqft } from '../../lib/format';

// jsdom in this test environment has no PointerEvent constructor at all
// (confirmed: `typeof PointerEvent === 'undefined'`), so
// @testing-library's fireEvent.pointerDown/Move/Up helpers dispatch an
// event that never carries clientX/clientY/pointerId through -- they come
// back `undefined` on the event RoofOutlineEditor's handlers receive.
// Dispatch a plain Event with those properties assigned directly instead;
// React's synthetic event system reads them straight off the native event
// object regardless of its concrete class.
function firePointer(
  element: Element,
  type: 'pointerdown' | 'pointermove' | 'pointerup',
  props: { clientX: number; clientY: number; pointerId: number }
) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, props);
  fireEvent(element, event);
}

// A ~20m x 15m rectangle at lat 27, matching the golden fixture in
// mercator.test.ts, so this component test is exercising real (already
// unit-tested elsewhere) mercator math end to end through pointer drags,
// not asserting against a hand-picked magic number.
const CENTER_LAT = 27;
const CENTER_LAT_RAD = (CENTER_LAT * Math.PI) / 180;
const METERS_PER_DEGREE_LAT = 111320;

const MAP_META: MapMeta = {
  centerLat: CENTER_LAT,
  centerLng: -82.5,
  zoom: 21,
  sw: {
    lat: CENTER_LAT - 7.5 / METERS_PER_DEGREE_LAT,
    lng: -82.5 - 10 / (METERS_PER_DEGREE_LAT * Math.cos(CENTER_LAT_RAD)),
  },
  ne: {
    lat: CENTER_LAT + 7.5 / METERS_PER_DEGREE_LAT,
    lng: -82.5 + 10 / (METERS_PER_DEGREE_LAT * Math.cos(CENTER_LAT_RAD)),
  },
  imgW: 1280,
  imgH: 800,
};

// A real mapMeta captured live from /api/measure (feedback5a-report.md),
// with a low enough zoom (20, wider ground coverage than MAP_META's zoom
// 21) that dragging its corners out to the full 1280x800 image genuinely
// exceeds @chq/pricing's sqFromOutline (0, 20000] range -- verified
// directly: that full-image rectangle projects to ~48,464 sqft here,
// vs. only ~12,189 sqft for MAP_META above (too small to ever trigger the
// guard by dragging alone).
const LARGE_AREA_MAP_META: MapMeta = {
  centerLat: 27.336230049999998,
  centerLng: -82.539976,
  zoom: 20,
  sw: { lat: 27.3360897, lng: -82.5400199 },
  ne: { lat: 27.3363704, lng: -82.5399321 },
  imgW: 1280,
  imgH: 800,
};

// Corner order matches the store's outlineCorners / RoofOutlineEditor's
// `corners` prop: sw, nw, ne, se.
const INITIAL_LATLNG_CORNERS = [
  { lat: MAP_META.sw.lat, lng: MAP_META.sw.lng },
  { lat: MAP_META.ne.lat, lng: MAP_META.sw.lng },
  { lat: MAP_META.ne.lat, lng: MAP_META.ne.lng },
  { lat: MAP_META.sw.lat, lng: MAP_META.ne.lng },
];
const INITIAL_PX = INITIAL_LATLNG_CORNERS.map(({ lat, lng }) => latLngToImagePx(lat, lng, MAP_META));

const LARGE_AREA_LATLNG_CORNERS = [
  { lat: LARGE_AREA_MAP_META.sw.lat, lng: LARGE_AREA_MAP_META.sw.lng },
  { lat: LARGE_AREA_MAP_META.ne.lat, lng: LARGE_AREA_MAP_META.sw.lng },
  { lat: LARGE_AREA_MAP_META.ne.lat, lng: LARGE_AREA_MAP_META.ne.lng },
  { lat: LARGE_AREA_MAP_META.sw.lat, lng: LARGE_AREA_MAP_META.ne.lng },
];
const LARGE_AREA_INITIAL_PX = LARGE_AREA_LATLNG_CORNERS.map(({ lat, lng }) =>
  latLngToImagePx(lat, lng, LARGE_AREA_MAP_META)
);

function sqftFor(pxCorners: Array<{ x: number; y: number }>): number {
  const meters = pxCorners.map((p) => imagePxToMetersFromCenter(p, MAP_META));
  return areaM2ToSqft(shoelaceAreaM2(meters));
}

beforeEach(() => {
  // The editor's drag math reads the surface container's on-screen box via
  // getBoundingClientRect() and maps clientX/Y into mapMeta's image-pixel
  // space. Mock it 1:1 with the image's native pixel size so
  // clientX/clientY in tests can be given directly in image-px units.
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    width: MAP_META.imgW,
    height: MAP_META.imgH,
    right: MAP_META.imgW,
    bottom: MAP_META.imgH,
    x: 0,
    y: 0,
    toJSON: () => {},
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('RoofOutlineEditor', () => {
  it('shows an initial "about N sq ft" readout derived from the given corners', () => {
    render(
      <RoofOutlineEditor
        imageUrl="aerial.png"
        mapMeta={MAP_META}
        corners={INITIAL_LATLNG_CORNERS}
        onApply={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    const expectedInitialSqft = sqftFor(INITIAL_PX);
    expect(screen.getByTestId('roof-outline-live-sqft').textContent).toBe(
      `About ${formatFootprintSqft(expectedInitialSqft)} sq ft`
    );
    // Golden ballpark from mercator.test.ts's equivalent fixture: ~300 m2.
    expect(expectedInitialSqft).toBeCloseTo(3229.17, -1);
  });

  it('starts from an already-adjusted set of corners, not the bbox, when given one (reopening after a prior adjustment)', () => {
    render(
      <RoofOutlineEditor
        imageUrl="aerial.png"
        mapMeta={MAP_META}
        corners={INITIAL_LATLNG_CORNERS}
        onApply={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    const bboxSqft = sqftFor(INITIAL_PX);

    cleanup();

    // A genuinely different (previously-adjusted) set of corners, further
    // out than the bbox -- this must change the INITIAL readout, proving
    // the editor seeded its state from `corners`, not from mapMeta.sw/ne.
    const grown = [
      { lat: MAP_META.sw.lat - 0.00002, lng: MAP_META.sw.lng - 0.00002 },
      { lat: MAP_META.ne.lat + 0.00002, lng: MAP_META.sw.lng - 0.00002 },
      { lat: MAP_META.ne.lat + 0.00002, lng: MAP_META.ne.lng + 0.00002 },
      { lat: MAP_META.sw.lat - 0.00002, lng: MAP_META.ne.lng + 0.00002 },
    ];
    render(
      <RoofOutlineEditor
        imageUrl="aerial.png"
        mapMeta={MAP_META}
        corners={grown}
        onApply={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    const grownPx = grown.map(({ lat, lng }) => latLngToImagePx(lat, lng, MAP_META));
    const expectedGrownSqft = sqftFor(grownPx);
    expect(screen.getByTestId('roof-outline-live-sqft').textContent).toBe(
      `About ${formatFootprintSqft(expectedGrownSqft)} sq ft`
    );
    expect(expectedGrownSqft).toBeGreaterThan(bboxSqft);
  });

  it('dragging a corner (pointerdown -> pointermove) live-updates the sq ft readout to match the new geometry', () => {
    render(
      <RoofOutlineEditor
        imageUrl="aerial.png"
        mapMeta={MAP_META}
        corners={INITIAL_LATLNG_CORNERS}
        onApply={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    const handle0 = screen.getByTestId('roof-outline-corner-0');
    const start = INITIAL_PX[0]!;

    firePointer(handle0, 'pointerdown', { pointerId: 1, clientX: start.x, clientY: start.y });
    // Drag the SW corner 100 image-px further out (both axes), growing the
    // quad -- pointer capture isn't available in jsdom, but the component
    // guards that with optional chaining and still updates state directly.
    const moved = { x: start.x - 100, y: start.y + 100 };
    firePointer(handle0, 'pointermove', { pointerId: 1, clientX: moved.x, clientY: moved.y });
    firePointer(handle0, 'pointerup', { pointerId: 1, clientX: moved.x, clientY: moved.y });

    const expectedSqft = sqftFor([moved, INITIAL_PX[1]!, INITIAL_PX[2]!, INITIAL_PX[3]!]);
    expect(screen.getByTestId('roof-outline-live-sqft').textContent).toBe(
      `About ${formatFootprintSqft(expectedSqft)} sq ft`
    );
    // Growing the quad outward must increase the footprint vs. the initial one.
    expect(expectedSqft).toBeGreaterThan(sqftFor(INITIAL_PX));
  });

  it('ignores a pointermove for a corner that was never pressed down (no drag in progress)', () => {
    render(
      <RoofOutlineEditor
        imageUrl="aerial.png"
        mapMeta={MAP_META}
        corners={INITIAL_LATLNG_CORNERS}
        onApply={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    const initialText = screen.getByTestId('roof-outline-live-sqft').textContent;

    firePointer(screen.getByTestId('roof-outline-corner-0'), 'pointermove', {
      pointerId: 1,
      clientX: 999,
      clientY: 999,
    });

    expect(screen.getByTestId('roof-outline-live-sqft').textContent).toBe(initialText);
  });

  it('clamps a corner drag to stay within the image bounds', () => {
    render(
      <RoofOutlineEditor
        imageUrl="aerial.png"
        mapMeta={MAP_META}
        corners={INITIAL_LATLNG_CORNERS}
        onApply={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    const handle0 = screen.getByTestId('roof-outline-corner-0');

    firePointer(handle0, 'pointerdown', { pointerId: 1, clientX: -5000, clientY: -5000 });

    const expectedSqft = sqftFor([{ x: 0, y: 0 }, INITIAL_PX[1]!, INITIAL_PX[2]!, INITIAL_PX[3]!]);
    expect(screen.getByTestId('roof-outline-live-sqft').textContent).toBe(
      `About ${formatFootprintSqft(expectedSqft)} sq ft`
    );
  });

  it('"Use this outline" calls onApply with the current live sq ft and the current corners as lat/lng', () => {
    const onApply = vi.fn();
    render(
      <RoofOutlineEditor
        imageUrl="aerial.png"
        mapMeta={MAP_META}
        corners={INITIAL_LATLNG_CORNERS}
        onApply={onApply}
        onCancel={vi.fn()}
      />
    );

    const handle0 = screen.getByTestId('roof-outline-corner-0');
    const start = INITIAL_PX[0]!;
    const moved = { x: start.x - 60, y: start.y + 40 };
    firePointer(handle0, 'pointerdown', { pointerId: 1, clientX: start.x, clientY: start.y });
    firePointer(handle0, 'pointermove', { pointerId: 1, clientX: moved.x, clientY: moved.y });

    fireEvent.click(screen.getByRole('button', { name: 'Use this outline' }));

    const expectedSqft = sqftFor([moved, INITIAL_PX[1]!, INITIAL_PX[2]!, INITIAL_PX[3]!]);
    expect(onApply).toHaveBeenCalledTimes(1);
    const [sqftArg, cornersArg] = onApply.mock.calls[0]!;
    expect(sqftArg).toBeCloseTo(expectedSqft, 2);
    // The applied corners round-trip back (via the same mercator math) to
    // the dragged pixel positions -- proving onApply's second argument is
    // the ACTUAL adjusted quad, not the original bbox.
    expect(cornersArg).toHaveLength(4);
    const roundTripped = (cornersArg as Array<{ lat: number; lng: number }>).map(({ lat, lng }) =>
      latLngToImagePx(lat, lng, MAP_META)
    );
    expect(roundTripped[0]!.x).toBeCloseTo(moved.x, 3);
    expect(roundTripped[0]!.y).toBeCloseTo(moved.y, 3);
  });

  it('"Cancel" calls onCancel and never onApply, regardless of any dragging done first', () => {
    const onApply = vi.fn();
    const onCancel = vi.fn();
    render(
      <RoofOutlineEditor
        imageUrl="aerial.png"
        mapMeta={MAP_META}
        corners={INITIAL_LATLNG_CORNERS}
        onApply={onApply}
        onCancel={onCancel}
      />
    );

    const handle0 = screen.getByTestId('roof-outline-corner-0');
    firePointer(handle0, 'pointerdown', { pointerId: 1, clientX: 200, clientY: 200 });
    firePointer(handle0, 'pointermove', { pointerId: 1, clientX: 300, clientY: 300 });

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onApply).not.toHaveBeenCalled();
  });

  it('renders exactly 4 draggable corner handles', () => {
    render(
      <RoofOutlineEditor
        imageUrl="aerial.png"
        mapMeta={MAP_META}
        corners={INITIAL_LATLNG_CORNERS}
        onApply={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    for (let i = 0; i < 4; i++) {
      expect(screen.getByTestId(`roof-outline-corner-${i}`)).toBeTruthy();
    }
  });

  it('disables "Use this outline" and shows a warning when a drag produces an unrealistic (out of pricing-engine range) footprint', () => {
    const onApply = vi.fn();
    render(
      <RoofOutlineEditor
        imageUrl="aerial.png"
        mapMeta={LARGE_AREA_MAP_META}
        corners={LARGE_AREA_LATLNG_CORNERS}
        onApply={onApply}
        onCancel={vi.fn()}
      />
    );

    // Drag all 4 corners out to their own quadrant's image corner (sw->
    // bottom-left, nw->top-left, ne->top-right, se->bottom-right) so the
    // quad stays simple/convex (not a self-intersecting bowtie) while
    // growing to roughly the full 1280x800 image -- @chq/pricing's
    // sqFromOutline only accepts (0, 20000], and the full image frames
    // well beyond just the building (FRAMING_PADDING), so this quad is
    // well outside that range.
    const { imgW, imgH } = LARGE_AREA_MAP_META;
    firePointer(screen.getByTestId('roof-outline-corner-0'), 'pointerdown', {
      pointerId: 1,
      clientX: 0,
      clientY: imgH,
    });
    firePointer(screen.getByTestId('roof-outline-corner-1'), 'pointerdown', {
      pointerId: 2,
      clientX: 0,
      clientY: 0,
    });
    firePointer(screen.getByTestId('roof-outline-corner-2'), 'pointerdown', {
      pointerId: 3,
      clientX: imgW,
      clientY: 0,
    });
    firePointer(screen.getByTestId('roof-outline-corner-3'), 'pointerdown', {
      pointerId: 4,
      clientX: imgW,
      clientY: imgH,
    });

    const button = screen.getByRole('button', { name: 'Use this outline' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(
      screen.getByText("That outline isn't a realistic footprint. Drag the corners closer to your roof.")
    ).toBeTruthy();

    fireEvent.click(button);
    expect(onApply).not.toHaveBeenCalled();
  });

  it('re-enables "Use this outline" once corners are dragged back to a realistic footprint', () => {
    const onApply = vi.fn();
    render(
      <RoofOutlineEditor
        imageUrl="aerial.png"
        mapMeta={LARGE_AREA_MAP_META}
        corners={LARGE_AREA_LATLNG_CORNERS}
        onApply={onApply}
        onCancel={vi.fn()}
      />
    );

    const { imgW, imgH } = LARGE_AREA_MAP_META;
    const handles = [0, 1, 2, 3].map((i) => screen.getByTestId(`roof-outline-corner-${i}`));
    const extremes = [
      { x: 0, y: imgH },
      { x: 0, y: 0 },
      { x: imgW, y: 0 },
      { x: imgW, y: imgH },
    ];
    handles.forEach((handle, i) => {
      firePointer(handle, 'pointerdown', { pointerId: i + 1, clientX: extremes[i]!.x, clientY: extremes[i]!.y });
    });
    expect((screen.getByRole('button', { name: 'Use this outline' }) as HTMLButtonElement).disabled).toBe(true);

    // Drag every corner back to its original bbox-derived position. Using
    // a fresh pointerdown per corner (rather than pointermove) sidesteps
    // needing to track which single corner index is "currently dragging" --
    // pointerdown itself snaps that corner to the given position.
    handles.forEach((handle, i) => {
      const p = LARGE_AREA_INITIAL_PX[i]!;
      firePointer(handle, 'pointerdown', { pointerId: i + 1, clientX: p.x, clientY: p.y });
    });

    const button = screen.getByRole('button', { name: 'Use this outline' }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    fireEvent.click(button);
    expect(onApply).toHaveBeenCalledTimes(1);
  });
});
