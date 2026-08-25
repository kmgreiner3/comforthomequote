import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useBuild } from '../../state/build';
import StepHome from './StepHome';

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
  it('shows the confirmation card, never renders the sqft number, and confirming sets outlineSource=satellite', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({ found: true, outlineSqft: 1850.5 }),
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const { onContinue } = setup();

    await screen.findByText('We sized your roof from satellite imagery.');

    // Hard rule: never render the satellite-path area/sqft number anywhere.
    expect(document.body.textContent).not.toMatch(/1850/);
    expect(document.body.textContent).not.toMatch(/sq ft/i);

    fireEvent.click(screen.getByRole('button', { name: 'Looks right, continue' }));

    expect(onContinue).toHaveBeenCalledTimes(1);
    const s = useBuild.getState();
    expect(s.outlineSource).toBe('satellite');
    expect(s.outlineSqft).toBe(1850.5);
    expect(s.sq).not.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
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

    await screen.findByText('We sized your roof from satellite imagery.');

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

    await screen.findByText('We sized your roof from satellite imagery.');

    const img = (await screen.findByAltText('Aerial view of your home')) as HTMLImageElement;
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

    await screen.findByText('We sized your roof from satellite imagery.');

    expect(screen.queryByAltText('Aerial view of your home')).toBeNull();
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

    const img = await screen.findByAltText('Aerial view of your home');
    fireEvent.error(img);

    expect(screen.queryByAltText('Aerial view of your home')).toBeNull();
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

    await screen.findByAltText('Aerial view of your home');

    fireEvent.click(
      screen.getByText("Prefer to enter your home's footprint? Enter it manually.")
    );

    await screen.findByLabelText('Home footprint (sq ft)');

    expect(screen.queryByAltText('Aerial view of your home')).toBeNull();
    expect(useBuild.getState().propertyImageUrl).toBeNull();
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
    expect(screen.queryByText('We sized your roof from satellite imagery.')).toBeNull();
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
    await screen.findByText('We sized your roof from satellite imagery.');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    cleanup();

    // Re-entry: same address, no sq committed yet (user never clicked
    // "Looks right, continue"). Must reuse the cached "found" outcome
    // instead of calling /api/measure again.
    const onContinue = vi.fn();
    render(<StepHome onContinue={onContinue} onBack={vi.fn()} />);

    await screen.findByText('We sized your roof from satellite imagery.');
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
    await screen.findByText('We sized your roof from satellite imagery.');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    cleanup();
    useBuild.getState().setAddress('456 Ocean Dr, Miami, FL');
    render(<StepHome onContinue={vi.fn()} onBack={vi.fn()} />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });
});
