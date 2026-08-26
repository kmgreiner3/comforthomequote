import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useBuild } from '../../state/build';
import StepHome from './StepHome';
import { latLngToImagePx } from '../../lib/mercator';

// jsdom does not implement matchMedia; motion/react's useReducedMotion()
// (used by RevealGroup/RevealItem) reads it on every render. Stub it to
// report "reduced motion" so steps render as plain inert divs -- keeps
// these tests about StepHome's fetch/phase logic, not animation timing.
beforeEach(() => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: true,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;

  useBuild.getState().reset();
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  // Safety net: if a fake-timers test fails/throws before reaching its own
  // vi.useRealTimers(), leaked fake timers would hang every subsequent
  // test's findBy*/waitFor polling (which relies on real timers).
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const ADDRESS = '123 Palm Ave, Tampa, FL';

function setup(address = ADDRESS) {
  useBuild.getState().setAddress(address);
  const onContinue = vi.fn();
  const onBack = vi.fn();
  render(<StepHome onContinue={onContinue} onBack={onBack} />);
  return { onContinue, onBack };
}

describe('StepHome satellite measurement: loading state', () => {
  it('shows the satellite loading message immediately, and never the manual form, while the fetch is in flight', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {})) // never resolves for this test
    );

    setup();

    expect(screen.getByText('Sizing your roof from satellite imagery...')).toBeTruthy();
    expect(screen.queryByLabelText('Home footprint (sq ft)')).toBeNull();
  });
});

describe('StepHome satellite measurement: found -> confirm', () => {
  it('shows the confirmation card with the rounded footprint, never the exact number or squares, and confirming sets outlineSource=satellite', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({ found: true, outlineSqft: 2308.32 }),
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const { onContinue } = setup();

    await screen.findByText('We found your roof.');

    // AUTHORIZED display exception (Kyle, 2026-08-25): the rounded footprint
    // sq ft may render. It must be rounded to the nearest 50 with a
    // thousands separator -- never the exact value -- and roofing squares
    // must never appear anywhere.
    expect(screen.getByText(/Roof footprint: about 2,300 sq ft/)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/2308/);
    expect(document.body.textContent).not.toMatch(/squares?\b/i);

    fireEvent.click(screen.getByRole('button', { name: 'Looks right, continue' }));

    expect(onContinue).toHaveBeenCalledTimes(1);
    const s = useBuild.getState();
    expect(s.outlineSource).toBe('satellite');
    // The store still keeps the exact, unrounded value for pricing.
    expect(s.outlineSqft).toBe(2308.32);
    expect(s.sq).not.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rounds to the nearest 50 at both edges of a bucket (2324 -> 2,300, 2326 -> 2,350)', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve({ ok: true, json: async () => ({ found: true, outlineSqft: 2324 }) })
    );
    vi.stubGlobal('fetch', fetchMock);
    setup();
    await screen.findByText(/Roof footprint: about 2,300 sq ft/);
    cleanup();

    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: true, json: async () => ({ found: true, outlineSqft: 2326 }) }))
    );
    setup('456 Ocean Dr, Miami, FL');
    await screen.findByText(/Roof footprint: about 2,350 sq ft/);
  });

  it('lets the homeowner switch to manual entry instead, without ever prefilling the satellite number', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({ found: true, outlineSqft: 2400 }),
        })
      )
    );

    setup();

    await screen.findByText('We found your roof.');

    fireEvent.click(
      screen.getByText("Prefer to enter your home's footprint? Enter it manually.")
    );

    const input = (await screen.findByLabelText('Home footprint (sq ft)')) as HTMLInputElement;
    expect(input.value).toBe('');

    fireEvent.change(input, { target: { value: '2100' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    const s = useBuild.getState();
    expect(s.outlineSource).toBe('manual');
    expect(s.outlineSqft).toBe(2100);
  });
});

// A real mapMeta captured live from /api/measure for a Sarasota, FL home
// (feedback5a-report.md) -- an internally-consistent center/zoom/bbox
// combination (unlike an arbitrary hand-picked one, which can imply a wildly
// unrealistic ground area once projected through the actual mercator math).
const MAP_META = {
  centerLat: 27.336230049999998,
  centerLng: -82.539976,
  zoom: 20,
  sw: { lat: 27.3360897, lng: -82.5400199 },
  ne: { lat: 27.3363704, lng: -82.5399321 },
  imgW: 1280,
  imgH: 800,
};

describe('StepHome satellite measurement: amber accuracy notice (feedback round 5)', () => {
  it('is always visible on the satellite confirm card', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: true, json: async () => ({ found: true, outlineSqft: 2000 }) }))
    );

    setup();
    await screen.findByText('We found your roof.');

    expect(
      screen.getByText(
        'The automated measurement may not be exact. A licensed professional reviews every roof and makes any needed adjustments before final pricing.'
      )
    ).toBeTruthy();
  });
});

describe('StepHome satellite measurement: sends placeId to /api/measure when present (feedback round 5)', () => {
  it('includes placeId in the request body when the store has one', () => {
    const fetchMock = vi.fn((_url: string, _init?: RequestInit) => new Promise(() => {}));
    vi.stubGlobal('fetch', fetchMock);

    useBuild.getState().setAddress(ADDRESS, 'places/abc123');
    render(<StepHome onContinue={vi.fn()} onBack={vi.fn()} />);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
    expect(body).toEqual({ address: ADDRESS, placeId: 'places/abc123' });
  });

  it('omits placeId entirely for a free-typed address', () => {
    const fetchMock = vi.fn((_url: string, _init?: RequestInit) => new Promise(() => {}));
    vi.stubGlobal('fetch', fetchMock);

    setup();

    const body = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
    expect(body).toEqual({ address: ADDRESS });
    expect(body.placeId).toBeUndefined();
  });
});

describe('StepHome satellite measurement: adjustable roof outline editor (feedback round 5)', () => {
  it('shows "Adjust outline" only when mapMeta and an image are both present', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({ found: true, outlineSqft: 2000, imageUrl: 'https://x/a.png', mapMeta: MAP_META }),
        })
      )
    );
    setup();
    await screen.findByText('We found your roof.');
    expect(screen.getByRole('button', { name: 'Adjust outline' })).toBeTruthy();
  });

  it('hides "Adjust outline" when the measure response has no mapMeta (no bounding box)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({ ok: true, json: async () => ({ found: true, outlineSqft: 2000 }) })
      )
    );
    setup();
    await screen.findByText('We found your roof.');
    expect(screen.queryByRole('button', { name: 'Adjust outline' })).toBeNull();
  });

  it('hides "Adjust outline" once the aerial image has failed to load', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({ found: true, outlineSqft: 2000, imageUrl: 'https://x/a.png', mapMeta: MAP_META }),
        })
      )
    );
    setup();
    const img = await screen.findByAltText('Aerial view with your roof outlined');
    fireEvent.error(img);
    expect(screen.queryByRole('button', { name: 'Adjust outline' })).toBeNull();
  });

  it('clicking "Adjust outline" enters the editor, and "Use this outline" commits an adjusted footprint back on the confirm card', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({ found: true, outlineSqft: 2000, imageUrl: 'https://x/a.png', mapMeta: MAP_META }),
        })
      )
    );
    const { onContinue } = setup();
    await screen.findByText('We found your roof.');

    fireEvent.click(screen.getByRole('button', { name: 'Adjust outline' }));

    expect(screen.getByText('Adjust the roof outline')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Use this outline' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Use this outline' }));

    // Back on the confirm card, with the store now committed as 'adjusted'.
    await screen.findByText('We found your roof.');
    expect(
      screen.getByText(
        'The automated measurement may not be exact. A licensed professional reviews every roof and makes any needed adjustments before final pricing.'
      )
    ).toBeTruthy();
    const s1 = useBuild.getState();
    expect(s1.outlineSource).toBe('adjusted');
    expect(s1.outlineSqft).not.toBeNull();

    // "Looks right, continue" must not re-tag the store back to 'satellite'.
    fireEvent.click(screen.getByRole('button', { name: 'Looks right, continue' }));
    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(useBuild.getState().outlineSource).toBe('adjusted');
  });

  it('"Cancel" in the editor discards changes and returns to the unadjusted confirm card', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({ found: true, outlineSqft: 2000, imageUrl: 'https://x/a.png', mapMeta: MAP_META }),
        })
      )
    );
    setup();
    await screen.findByText('We found your roof.');

    fireEvent.click(screen.getByRole('button', { name: 'Adjust outline' }));
    expect(screen.getByText('Adjust the roof outline')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await screen.findByText('We found your roof.');
    // Store was never touched by the editor at all -- still whatever it
    // was before entering (nothing, in this case: outlineSqft untouched).
    expect(useBuild.getState().outlineSqft).toBeNull();
    expect(useBuild.getState().outlineSource).toBeNull();
  });

  it('does not prefill the manual form with an adjusted saved outline either (same leak guard as satellite)', async () => {
    useBuild.setState({ outlineSource: 'adjusted', outlineSqft: 2417.6 });

    setup();

    const input = (await screen.findByLabelText('Home footprint (sq ft)')) as HTMLInputElement;
    expect(input.value).toBe('');
    expect(document.body.textContent).not.toMatch(/2417/);
  });
});

// sw -> nw -> ne -> se, matching the store's outlineCorners ordering, for
// MAP_META's bounding box.
const BBOX_CORNERS = [
  { lat: MAP_META.sw.lat, lng: MAP_META.sw.lng },
  { lat: MAP_META.ne.lat, lng: MAP_META.sw.lng },
  { lat: MAP_META.ne.lat, lng: MAP_META.ne.lng },
  { lat: MAP_META.sw.lat, lng: MAP_META.ne.lng },
];

function bboxPointsAttr(): string {
  return BBOX_CORNERS.map(({ lat, lng }) => latLngToImagePx(lat, lng, MAP_META))
    .map((p) => `${p.x},${p.y}`)
    .join(' ');
}

describe('StepHome satellite measurement: confirm card renders the outline overlay (feedback round 6)', () => {
  beforeEach(() => {
    // Same 1:1 mock RoofOutlineEditor.test.tsx uses: the drag math (and the
    // shared overlay's registration) reads the container's on-screen box
    // via getBoundingClientRect() and maps it into mapMeta's image-pixel
    // space. Mock it 1:1 with the image's native pixel size so clientX/Y
    // given in these tests can be read directly as image-px.
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

  function firePointer(
    element: Element,
    type: 'pointerdown' | 'pointermove' | 'pointerup',
    props: { clientX: number; clientY: number; pointerId: number }
  ) {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.assign(event, props);
    fireEvent(element, event);
  }

  it('golden: the confirm card renders a polygon matching the bbox corners for a fresh (unadjusted) measurement', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({ found: true, outlineSqft: 2308.32, imageUrl: 'https://x/a.png', mapMeta: MAP_META }),
        })
      )
    );
    setup();
    await screen.findByAltText('Aerial view with your roof outlined');

    const polygon = await waitFor(() => {
      const el = document.querySelector('svg polygon');
      expect(el).toBeTruthy();
      return el as SVGPolygonElement;
    });
    expect(polygon.getAttribute('points')).toBe(bboxPointsAttr());
  });

  it('after an adjustment, the confirm card polygon CHANGES to match the adjusted corners, not the original bbox', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({ found: true, outlineSqft: 2308.32, imageUrl: 'https://x/a.png', mapMeta: MAP_META }),
        })
      )
    );
    setup();
    await screen.findByText('We found your roof.');

    fireEvent.click(screen.getByRole('button', { name: 'Adjust outline' }));
    expect(screen.getByText('Adjust the roof outline')).toBeTruthy();

    const startPx = latLngToImagePx(BBOX_CORNERS[0]!.lat, BBOX_CORNERS[0]!.lng, MAP_META);
    const movedPx = { x: startPx.x - 60, y: startPx.y + 40 };
    const handle0 = screen.getByTestId('roof-outline-corner-0');
    firePointer(handle0, 'pointerdown', { pointerId: 1, clientX: startPx.x, clientY: startPx.y });
    firePointer(handle0, 'pointermove', { pointerId: 1, clientX: movedPx.x, clientY: movedPx.y });

    fireEvent.click(screen.getByRole('button', { name: 'Use this outline' }));

    await screen.findByText('We found your roof.');
    const adjustedCorners = useBuild.getState().outlineCorners;
    expect(adjustedCorners).not.toBeNull();

    const expectedPoints = adjustedCorners!
      .map(({ lat, lng }) => latLngToImagePx(lat, lng, MAP_META))
      .map((p) => `${p.x},${p.y}`)
      .join(' ');

    const polygon = await waitFor(() => {
      const el = document.querySelector('svg polygon');
      expect(el).toBeTruthy();
      return el as SVGPolygonElement;
    });
    expect(polygon.getAttribute('points')).toBe(expectedPoints);
    expect(polygon.getAttribute('points')).not.toBe(bboxPointsAttr());
  });

  it('reopening the editor after an adjustment starts from the adjusted corners, not the original bbox', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({ found: true, outlineSqft: 2308.32, imageUrl: 'https://x/a.png', mapMeta: MAP_META }),
        })
      )
    );
    setup();
    await screen.findByText('We found your roof.');

    fireEvent.click(screen.getByRole('button', { name: 'Adjust outline' }));
    const startPx = latLngToImagePx(BBOX_CORNERS[0]!.lat, BBOX_CORNERS[0]!.lng, MAP_META);
    const movedPx = { x: startPx.x - 60, y: startPx.y + 40 };
    const handle0 = screen.getByTestId('roof-outline-corner-0');
    firePointer(handle0, 'pointerdown', { pointerId: 1, clientX: startPx.x, clientY: startPx.y });
    firePointer(handle0, 'pointermove', { pointerId: 1, clientX: movedPx.x, clientY: movedPx.y });
    fireEvent.click(screen.getByRole('button', { name: 'Use this outline' }));
    await screen.findByText('We found your roof.');
    const adjustedCorners = useBuild.getState().outlineCorners!;

    // Reopen the editor: its own initial polygon (before any further drag)
    // must match the ADJUSTED corners the store now holds, not the
    // original bbox -- this is exactly what "editor initial corners come
    // from the store" means.
    fireEvent.click(screen.getByRole('button', { name: 'Adjust outline' }));
    expect(screen.getByText('Adjust the roof outline')).toBeTruthy();

    const editorPolygon = document.querySelector('svg polygon') as SVGPolygonElement;
    const expectedInitialPoints = adjustedCorners
      .map(({ lat, lng }) => latLngToImagePx(lat, lng, MAP_META))
      .map((p) => `${p.x},${p.y}`)
      .join(' ');
    expect(editorPolygon.getAttribute('points')).toBe(expectedInitialPoints);
    expect(editorPolygon.getAttribute('points')).not.toBe(bboxPointsAttr());

    // Cancel and confirm the store itself still holds the adjusted corners
    // (not reset back to the bbox by having reopened the editor).
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await screen.findByText('We found your roof.');
    expect(useBuild.getState().outlineCorners).toEqual(adjustedCorners);
  });

  it('missing mapMeta (no bounding box) renders the plain aerial photo with NO svg/polygon overlay', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({ found: true, outlineSqft: 1850.5, imageUrl: 'https://x/a.png' }),
        })
      )
    );
    setup();

    const img = await screen.findByAltText('Aerial view with your roof outlined');
    expect(img).toBeTruthy();
    expect(document.querySelector('svg polygon')).toBeNull();
    expect(useBuild.getState().mapMeta).toBeNull();
    expect(useBuild.getState().outlineCorners).toBeNull();
  });
});

describe('StepHome satellite measurement: property image', () => {
  it('shows the aerial photo above the confirmation message when measure returns an imageUrl', async () => {
    const imageUrl = 'https://chq-visualizer.s3.amazonaws.com/maps/abc123.png?X-Amz-Signature=xyz';
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({ found: true, outlineSqft: 1850.5, imageUrl }),
        })
      )
    );

    setup();

    await screen.findByText('We found your roof.');

    const img = (await screen.findByAltText('Aerial view with your roof outlined')) as HTMLImageElement;
    expect(img.src).toBe(imageUrl);
    expect(useBuild.getState().propertyImageUrl).toBe(imageUrl);
  });

  it('shows no image when measure omits imageUrl (Static Maps failure/unset)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({ found: true, outlineSqft: 1850.5 }),
        })
      )
    );

    setup();

    await screen.findByText('We found your roof.');

    expect(screen.queryByAltText('Aerial view with your roof outlined')).toBeNull();
    expect(useBuild.getState().propertyImageUrl).toBeNull();
  });

  it('hides the image silently on a load failure, without touching the store value', async () => {
    const imageUrl = 'https://chq-visualizer.s3.amazonaws.com/maps/abc123.png?X-Amz-Signature=xyz';
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({ found: true, outlineSqft: 1850.5, imageUrl }),
        })
      )
    );

    setup();

    const img = await screen.findByAltText('Aerial view with your roof outlined');
    fireEvent.error(img);

    expect(screen.queryByAltText('Aerial view with your roof outlined')).toBeNull();
    // The onError handler hides the <img>; it doesn't have to clear the
    // (possibly still-valid) URL out of the store.
    expect(useBuild.getState().propertyImageUrl).toBe(imageUrl);
    // No error/loading text left behind either.
    expect(document.body.textContent).not.toMatch(/error|failed|unable/i);
  });

  it('has no image on the manual path (switching away from a found satellite result clears it)', async () => {
    const imageUrl = 'https://chq-visualizer.s3.amazonaws.com/maps/abc123.png?X-Amz-Signature=xyz';
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({ found: true, outlineSqft: 1850.5, imageUrl }),
        })
      )
    );

    setup();

    await screen.findByAltText('Aerial view with your roof outlined');

    fireEvent.click(
      screen.getByText("Prefer to enter your home's footprint? Enter it manually.")
    );

    await screen.findByLabelText('Home footprint (sq ft)');

    expect(screen.queryByAltText('Aerial view with your roof outlined')).toBeNull();
    expect(useBuild.getState().propertyImageUrl).toBeNull();
  });
});

describe('StepHome satellite measurement: outside Florida', () => {
  it('shows the outside-Florida error card, never the manual fallback, and Fix my address goes back', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({ ok: true, json: async () => ({ found: false, reason: 'outside-florida' }) })
      )
    );

    const { onBack } = setup();

    await screen.findByText('That address is outside Florida.');
    expect(
      screen.getByText('We currently serve Florida homes only. Check the address and try again.')
    ).toBeTruthy();
    expect(screen.queryByLabelText('Home footprint (sq ft)')).toBeNull();
    expect(document.body.textContent).not.toMatch(/sizing your roof/i);

    fireEvent.click(screen.getByRole('button', { name: 'Fix my address' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('does not re-fetch on remount for the same address once outside-florida is cached', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve({ ok: true, json: async () => ({ found: false, reason: 'outside-florida' }) })
    );
    vi.stubGlobal('fetch', fetchMock);

    setup();
    await screen.findByText('That address is outside Florida.');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    cleanup();

    render(<StepHome onContinue={vi.fn()} onBack={vi.fn()} />);
    await screen.findByText('That address is outside Florida.');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('StepHome satellite measurement: fallback to manual', () => {
  it.each([
    ['available:false (no Google key configured)', async () => ({ ok: true, json: async () => ({ available: false }) })],
    ['found:false', async () => ({ ok: true, json: async () => ({ found: false, reason: 'not-found' }) })],
    ['non-200 response', async () => ({ ok: false, status: 500, json: async () => ({}) })],
    ['malformed JSON body', async () => ({ ok: true, json: async () => { throw new Error('bad json'); } })],
  ])('%s falls back to the unchanged manual form with no error UI', async (_label, responder) => {
    vi.stubGlobal('fetch', vi.fn(() => (responder as () => Promise<unknown>)()));

    setup();

    const input = (await screen.findByLabelText('Home footprint (sq ft)')) as HTMLInputElement;
    expect(input.value).toBe('');
    expect(screen.queryByText('We found your roof.')).toBeNull();
    expect(document.body.textContent).not.toMatch(/error|failed|unable|couldn.t/i);

    fireEvent.change(input, { target: { value: '2000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(useBuild.getState().outlineSource).toBe('manual');
    expect(useBuild.getState().outlineSqft).toBe(2000);
  });

  it('falls back on a rejected fetch (network error)', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('network down'))));

    setup();

    const input = await screen.findByLabelText('Home footprint (sq ft)');
    expect((input as HTMLInputElement).value).toBe('');
  });

  it('falls back when the 8s timeout elapses (AbortController fires)', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(
      (_url: string, init?: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const err = new Error('The operation was aborted');
            err.name = 'AbortError';
            reject(err);
          });
        })
    );
    vi.stubGlobal('fetch', fetchMock);

    setup();
    expect(screen.getByText('Sizing your roof from satellite imagery...')).toBeTruthy();

    // testing-library's findBy*/waitFor poll with real setTimeout, so they
    // must not run while fake timers are active (they'd hang forever
    // waiting for a tick fake time will never deliver on its own). Advance
    // fake time inside act() to flush the abort -> catch -> setState chain
    // synchronously, THEN switch back to real timers before querying.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(8000);
    });
    vi.useRealTimers();

    expect(screen.getByLabelText('Home footprint (sq ft)')).toBeTruthy();
  });
});

describe('StepHome satellite measurement: back-navigation number leak', () => {
  it('does not prefill the manual form with a satellite-sourced saved outline, and never renders its digits', async () => {
    useBuild.setState({
      outlineSource: 'satellite',
      outlineSqft: 6028.758585289504,
    });

    setup();

    const input = (await screen.findByLabelText('Home footprint (sq ft)')) as HTMLInputElement;
    expect(input.value).toBe('');
    expect(document.body.textContent).not.toMatch(/6028/);
  });
});

describe('StepHome satellite measurement: at-most-once per address', () => {
  it('does not re-fetch on remount for the same address once an outcome is cached', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({ found: true, outlineSqft: 1900 }),
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    setup();
    await screen.findByText('We found your roof.');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    cleanup();

    // Re-entry: same address, no sq committed yet (user never clicked
    // "Looks right, continue"). Must reuse the cached "found" outcome
    // instead of calling /api/measure again.
    const onContinue = vi.fn();
    render(<StepHome onContinue={onContinue} onBack={vi.fn()} />);

    await screen.findByText('We found your roof.');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does re-fetch when the address changed since the last attempt', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({ found: true, outlineSqft: 1900 }),
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    setup('123 Palm Ave, Tampa, FL');
    await screen.findByText('We found your roof.');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    cleanup();
    useBuild.getState().setAddress('456 Ocean Dr, Miami, FL');
    render(<StepHome onContinue={vi.fn()} onBack={vi.fn()} />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });
});
