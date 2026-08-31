import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useBuild } from '../../state/build';
import StepHome from './StepHome';

// jsdom does not implement matchMedia; motion/react's useReducedMotion()
// (used by RevealGroup/RevealItem) reads it on every render. Stub it to
// report "reduced motion" so steps render as plain inert divs -- keeps
// these tests about StepHome's own logic, not animation timing.
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
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const ADDRESS = '123 Palm Ave, Tampa, FL 33602';

// Pre-sets an address in the store before render, same as the pre-round-8
// StepHome tests did -- lands straight past state A (address entry) into
// state B (measuring), which is what most of these tests care about.
function setup(address = ADDRESS) {
  useBuild.getState().setAddress(address);
  const onContinue = vi.fn();
  render(<StepHome onContinue={onContinue} />);
  return { onContinue };
}

describe('StepHome: address entry (state A, feedback round 8 -- Home absorbs Address)', () => {
  it('shows the address entry form with no BackChevron when no address is set yet', () => {
    const onContinue = vi.fn();
    render(<StepHome onContinue={onContinue} />);

    expect(screen.getByText("Where's the roof?")).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
  });

  it('a free-typed address missing a ZIP errors and does not record an address', () => {
    const onContinue = vi.fn();
    render(<StepHome onContinue={onContinue} />);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: '123 Palm Ave, Tampa, FL' } });
    fireEvent.click(screen.getByRole('button', { name: 'Build My Roof' }));

    expect(screen.getByText('Include your ZIP code so we find the right home.')).toBeTruthy();
    expect(useBuild.getState().address).toBeNull();
  });

  it('a valid free-typed address submits, records it in the store, and moves into measuring -- all without calling onContinue', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    const onContinue = vi.fn();
    render(<StepHome onContinue={onContinue} />);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: ADDRESS } });
    fireEvent.click(screen.getByRole('button', { name: 'Build My Roof' }));

    expect(useBuild.getState().address).toBe(ADDRESS);
    expect(screen.getByText('Sizing your roof from satellite imagery...')).toBeTruthy();
    expect(onContinue).not.toHaveBeenCalled();
  });

  it('the inline address chip appears once an address is set, and "Change" reopens address entry', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: true, json: async () => ({ found: true, outlineSqft: 2000 }) }))
    );
    setup();
    await screen.findByText('We found your roof.');

    expect(screen.getByTestId('address-chip').textContent).toContain(ADDRESS);

    fireEvent.click(screen.getByRole('button', { name: 'Change' }));

    expect(screen.getByText("Where's the roof?")).toBeTruthy();
    // Nothing was cleared yet -- just reopened the entry form.
    expect(useBuild.getState().address).toBe(ADDRESS);
  });
});

describe('StepHome: satellite measurement -> confirm no longer navigates (feedback round 8)', () => {
  it('shows the confirmation card with the rounded footprint, and "Use this outline" commits the outline WITHOUT calling onContinue', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve({ ok: true, json: async () => ({ found: true, outlineSqft: 2308.32 }) })
    );
    vi.stubGlobal('fetch', fetchMock);

    const { onContinue } = setup();
    await screen.findByText('We found your roof.');

    // AUTHORIZED display exception: the rounded footprint may render, never
    // the exact number or roofing squares.
    expect(screen.getByText(/Roof footprint: about 2,300 sq ft/)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/2308/);
    expect(document.body.textContent).not.toMatch(/squares?\b/i);

    fireEvent.click(screen.getByRole('button', { name: 'Use this outline' }));

    expect(onContinue).not.toHaveBeenCalled();
    const s = useBuild.getState();
    expect(s.outlineSource).toBe('satellite');
    expect(s.outlineSqft).toBe(2308.32);
    expect(s.sq).not.toBeNull();
  });

  it('reveals the property questions block (solar) below confirm once the outline is committed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: true, json: async () => ({ found: true, outlineSqft: 2000 }) }))
    );
    setup();
    await screen.findByText('We found your roof.');

    expect(screen.queryByText('Do you have solar panels on your roof?')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Use this outline' }));

    expect(screen.getByText('Do you have solar panels on your roof?')).toBeTruthy();
  });
});

describe('StepHome: confirming collapses to the confirmed row (client feedback 2026-08-31)', () => {
  const MAP_META = {
    centerLat: 27.336230049999998,
    centerLng: -82.539976,
    zoom: 20,
    sw: { lat: 27.3360897, lng: -82.5400199 },
    ne: { lat: 27.3363704, lng: -82.5399321 },
    imgW: 1280,
    imgH: 800,
  };

  it('after "Use this outline" the confirm card is gone, the confirmed row shows, and focus lands on the questions block', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: true, json: async () => ({ found: true, outlineSqft: 2308.32 }) }))
    );
    setup();
    await screen.findByText('We found your roof.');

    fireEvent.click(screen.getByRole('button', { name: 'Use this outline' }));

    expect(screen.queryByText('We found your roof.')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Use this outline' })).toBeNull();
    expect(screen.getByText('Roof size confirmed.')).toBeTruthy();
    expect(screen.getByText(/About 2,300 sq ft footprint/)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/2308/);
    // The questions block itself holds focus so the next action is obvious.
    const questions = screen.getByText('Tell us about your property').closest('div[tabindex="-1"]');
    expect(questions).toBeTruthy();
    expect(document.activeElement).toBe(questions);
  });

  it('"Change" on a satellite outline reopens the confirm card, and re-confirming an adjusted one keeps outlineSource adjusted', async () => {
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
    fireEvent.click(screen.getByRole('button', { name: 'Use this outline' }));
    expect(useBuild.getState().outlineSource).toBe('satellite');

    fireEvent.click(screen.getByRole('button', { name: 'Change roof size' }));
    expect(await screen.findByText('We found your roof.')).toBeTruthy();

    // Adjust, apply, land back on confirm, confirm again: source stays adjusted.
    fireEvent.click(screen.getByRole('button', { name: 'Adjust outline' }));
    fireEvent.click(screen.getByRole('button', { name: 'Use this outline' }));
    await screen.findByText('We found your roof.');
    fireEvent.click(screen.getByRole('button', { name: 'Use this outline' }));
    expect(screen.getByText('Roof size confirmed.')).toBeTruthy();
    expect(useBuild.getState().outlineSource).toBe('adjusted');
  });

  it('manual commit collapses the form to the confirmed row too', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: true, json: async () => ({ found: false, reason: 'not-found' }) }))
    );
    setup();
    const input = (await screen.findByLabelText('Home footprint (sq ft)')) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '2000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Use this footprint' }));

    expect(screen.queryByLabelText('Home footprint (sq ft)')).toBeNull();
    expect(screen.getByText('Roof size confirmed.')).toBeTruthy();
    expect(screen.getByText('2,000 sq ft footprint.')).toBeTruthy();
  });
});

describe('StepHome: solar question gates the real Continue (feedback round 8, item 8)', () => {
  async function commitOutline() {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: true, json: async () => ({ found: true, outlineSqft: 2000 }) }))
    );
    const result = setup();
    await screen.findByText('We found your roof.');
    fireEvent.click(screen.getByRole('button', { name: 'Use this outline' }));
    return result;
  }

  it('Continue is disabled until solarPanels is explicitly answered, even though the outline is already committed', async () => {
    await commitOutline();

    const continueButton = screen.getByRole('button', { name: 'Continue' }) as HTMLButtonElement;
    expect(continueButton.disabled).toBe(true);
    expect(useBuild.getState().solarPanels).toBeNull();
  });

  it('"No solar panels" answers 0 and enables Continue; clicking it calls onContinue', async () => {
    const { onContinue } = await commitOutline();

    fireEvent.click(screen.getByRole('button', { name: 'No solar panels' }));
    expect(useBuild.getState().solarPanels).toBe(0);

    const continueButton = screen.getByRole('button', { name: 'Continue' }) as HTMLButtonElement;
    expect(continueButton.disabled).toBe(false);

    fireEvent.click(continueButton);
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('"Yes" defaults the count to 1 and reveals a 1..60 stepper', async () => {
    await commitOutline();

    fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
    expect(useBuild.getState().solarPanels).toBe(1);
    expect(screen.getByText('1')).toBeTruthy();

    const continueButton = screen.getByRole('button', { name: 'Continue' }) as HTMLButtonElement;
    expect(continueButton.disabled).toBe(false);
  });

  it('the stepper increments and decrements, clamped to [1, 60]', async () => {
    await commitOutline();
    fireEvent.click(screen.getByRole('button', { name: 'Yes' }));

    fireEvent.click(screen.getByRole('button', { name: 'Decrease panel count' }));
    expect(useBuild.getState().solarPanels).toBe(1); // clamped, was already 1

    fireEvent.click(screen.getByRole('button', { name: 'Increase panel count' }));
    fireEvent.click(screen.getByRole('button', { name: 'Increase panel count' }));
    expect(useBuild.getState().solarPanels).toBe(3);

    for (let i = 0; i < 60; i++) {
      fireEvent.click(screen.getByRole('button', { name: 'Increase panel count' }));
    }
    expect(useBuild.getState().solarPanels).toBe(60);
  });

  it('switching from "Yes" back to "No solar panels" answers 0 again', async () => {
    await commitOutline();
    fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Increase panel count' }));
    expect(useBuild.getState().solarPanels).toBe(2);

    fireEvent.click(screen.getByRole('button', { name: 'No solar panels' }));
    expect(useBuild.getState().solarPanels).toBe(0);
    expect(screen.queryByLabelText('Number of solar panels')).toBeNull();
  });
});

describe('StepHome: manual entry commits without navigating either', () => {
  it.each([
    ['available:false (no Google key configured)', async () => ({ ok: true, json: async () => ({ available: false }) })],
    ['found:false', async () => ({ ok: true, json: async () => ({ found: false, reason: 'not-found' }) })],
  ])('%s falls back to the manual form; "Use this footprint" commits without calling onContinue', async (_label, responder) => {
    vi.stubGlobal('fetch', vi.fn(() => (responder as () => Promise<unknown>)()));

    const { onContinue } = setup();

    const input = (await screen.findByLabelText('Home footprint (sq ft)')) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '2000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Use this footprint' }));

    expect(onContinue).not.toHaveBeenCalled();
    const s = useBuild.getState();
    expect(s.outlineSource).toBe('manual');
    expect(s.outlineSqft).toBe(2000);
    expect(screen.getByText('Do you have solar panels on your roof?')).toBeTruthy();
  });

  it('a satellite-sourced committed outline remounts into the confirmed row: rounded display only, exact digits never render, no manual input', async () => {
    useBuild.getState().setAddress(ADDRESS);
    useBuild.setState({ outlineSource: 'satellite', outlineSqft: 6028.758585289504, sq: 73 });

    setup();

    expect(await screen.findByText('Roof size confirmed.')).toBeTruthy();
    expect(screen.getByText(/About 6,050 sq ft footprint/)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/6028/);
    expect(screen.queryByLabelText('Home footprint (sq ft)')).toBeNull();
  });

  it('a manual committed outline remounts into the confirmed row with the exact value, and "Change" reopens the prefilled form', async () => {
    useBuild.getState().setAddress(ADDRESS);
    useBuild.setState({ outlineSource: 'manual', outlineSqft: 2000, sq: 24 });

    setup();

    expect(await screen.findByText('Roof size confirmed.')).toBeTruthy();
    expect(screen.getByText('2,000 sq ft footprint.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Change roof size' }));
    const input = (await screen.findByLabelText('Home footprint (sq ft)')) as HTMLInputElement;
    expect(input.value).toBe('2000');
  });
});

describe('StepHome: outside Florida', () => {
  it('shows the outside-Florida error card, and "Fix my address" reopens address entry', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: true, json: async () => ({ found: false, reason: 'outside-florida' }) }))
    );

    setup();

    await screen.findByText('That address is outside Florida.');
    fireEvent.click(screen.getByRole('button', { name: 'Fix my address' }));

    expect(screen.getByText("Where's the roof?")).toBeTruthy();
  });
});

describe('StepHome: adjusted outline editor still works, and applying it does not navigate', () => {
  const MAP_META = {
    centerLat: 27.336230049999998,
    centerLng: -82.539976,
    zoom: 20,
    sw: { lat: 27.3360897, lng: -82.5400199 },
    ne: { lat: 27.3363704, lng: -82.5399321 },
    imgW: 1280,
    imgH: 800,
  };

  it('"Adjust outline" -> "Use this outline" commits an adjusted footprint, returns to the confirm card, and does not call onContinue', async () => {
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

    fireEvent.click(screen.getByRole('button', { name: 'Use this outline' }));

    await screen.findByText('We found your roof.');
    expect(useBuild.getState().outlineSource).toBe('adjusted');
    expect(onContinue).not.toHaveBeenCalled();
  });
});

describe('StepHome: trace mode (no-solar-data) also just commits, then reveals the property questions', () => {
  const SEED_MAP_META = {
    centerLat: 27.10005,
    centerLng: -82.09995,
    zoom: 20,
    sw: { lat: 27.1, lng: -82.1 },
    ne: { lat: 27.1001, lng: -82.0999 },
    imgW: 1280,
    imgH: 800,
  };
  function midpoint(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
    return { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
  }
  function seedCornersFor(meta: typeof SEED_MAP_META) {
    const sw = { lat: meta.sw.lat, lng: meta.sw.lng };
    const nw = { lat: meta.ne.lat, lng: meta.sw.lng };
    const ne = { lat: meta.ne.lat, lng: meta.ne.lng };
    const se = { lat: meta.sw.lat, lng: meta.ne.lng };
    return [sw, midpoint(sw, nw), nw, ne, midpoint(ne, se), se];
  }
  const NO_SOLAR_RESPONSE = {
    found: false,
    reason: 'no-solar-data',
    imageUrl: 'https://x/seed.png',
    mapMeta: SEED_MAP_META,
    seedCorners: seedCornersFor(SEED_MAP_META),
  };

  it('"Use this outline" commits the traced footprint as adjusted, without navigating, then the solar question appears', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, json: async () => NO_SOLAR_RESPONSE })));
    const { onContinue } = setup();

    await screen.findByText('Draw your roof outline');
    fireEvent.click(screen.getByRole('button', { name: 'Use this outline' }));

    expect(onContinue).not.toHaveBeenCalled();
    const s = useBuild.getState();
    expect(s.outlineSource).toBe('adjusted');
    expect(s.outlineSqft).not.toBeNull();
    await waitFor(() => expect(screen.getByText('Do you have solar panels on your roof?')).toBeTruthy());
  });
});

describe('StepHome: 8s measurement timeout still falls back to manual (unchanged behavior)', () => {
  it('falls back when the timeout elapses', async () => {
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

    await act(async () => {
      await vi.advanceTimersByTimeAsync(8000);
    });
    vi.useRealTimers();

    expect(screen.getByLabelText('Home footprint (sq ft)')).toBeTruthy();
  });
});
