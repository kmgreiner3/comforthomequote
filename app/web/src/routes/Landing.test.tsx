import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Landing from './Landing';
import { useBuild } from '../state/build';

// Feedback round 7, Task C item 1: same picked-suggestion-skips-validation
// contract as StepAddress.test.tsx, for the landing hero's own copy of the
// combobox flow.

beforeEach(() => {
  useBuild.getState().reset();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const NO_ZIP_SUGGESTION_RESPONSE = {
  suggestions: [{ description: '8491 60th Street, Pinellas Park, FL, USA', placeId: 'places/pinellas-1' }],
};

function renderLanding() {
  return render(
    <MemoryRouter>
      <Landing />
    </MemoryRouter>
  );
}

describe('Landing: picked suggestions skip client-side format validation (feedback round 7)', () => {
  it('a picked suggestion missing a ZIP still submits successfully, with no validation error', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: true, json: async () => NO_ZIP_SUGGESTION_RESPONSE }))
    );
    renderLanding();

    fireEvent.change(screen.getByLabelText('Property address'), { target: { value: '8491 60th Street' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    fireEvent.click(screen.getByRole('option'));

    fireEvent.click(screen.getByRole('button', { name: 'Build My Roof' }));

    expect(screen.queryByText(/Include your ZIP code/)).toBeNull();
    const s = useBuild.getState();
    expect(s.address).toBe('8491 60th Street, Pinellas Park, FL, USA');
    expect(s.placeId).toBe('places/pinellas-1');
  });

  it('a free-typed address missing a ZIP still errors and does not store an address', () => {
    renderLanding();

    fireEvent.change(screen.getByLabelText('Property address'), { target: { value: '123 Palm Ave, Tampa, FL' } });
    fireEvent.click(screen.getByRole('button', { name: 'Build My Roof' }));

    expect(screen.getByText('Include your ZIP code so we find the right home.')).toBeTruthy();
    expect(useBuild.getState().address).toBeNull();
  });

  it('a free-typed full address (with ZIP) still submits normally, with no placeId', () => {
    renderLanding();

    fireEvent.change(screen.getByLabelText('Property address'), {
      target: { value: '123 Palm Ave, Tampa, FL 33602' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Build My Roof' }));

    expect(useBuild.getState().address).toBe('123 Palm Ave, Tampa, FL 33602');
    expect(useBuild.getState().placeId).toBeNull();
  });
});
