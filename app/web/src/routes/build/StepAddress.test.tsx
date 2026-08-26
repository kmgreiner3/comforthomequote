import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import StepAddress from './StepAddress';
import { useBuild } from '../../state/build';

// Feedback round 7, Task C item 1: the reported bug is that Google's
// suggestion descriptions omit the postal code ("8491 60th Street,
// Pinellas Park, FL, USA"), and the client-side format check (which
// demands a ZIP) was rejecting a PICKED suggestion because of it, even
// though a placeId is authoritative and needs no format check at all. Free-
// typed submits must keep the existing validation.

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

describe('StepAddress: picked suggestions skip client-side format validation (feedback round 7)', () => {
  it('a picked suggestion missing a ZIP still submits successfully, with no validation error', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: true, json: async () => NO_ZIP_SUGGESTION_RESPONSE }))
    );
    const onContinue = vi.fn();
    render(<StepAddress onContinue={onContinue} />);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: '8491 60th Street' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    fireEvent.click(screen.getByRole('option'));

    fireEvent.click(screen.getByRole('button', { name: 'Build My Roof' }));

    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/Include your ZIP code/)).toBeNull();
    expect(screen.queryByText(/Enter your full street address/)).toBeNull();

    const s = useBuild.getState();
    expect(s.address).toBe('8491 60th Street, Pinellas Park, FL, USA');
    expect(s.placeId).toBe('places/pinellas-1');
  });

  it('a free-typed address missing a ZIP still errors and does not submit (validation stays in force)', () => {
    const onContinue = vi.fn();
    render(<StepAddress onContinue={onContinue} />);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: '123 Palm Ave, Tampa, FL' } });
    fireEvent.click(screen.getByRole('button', { name: 'Build My Roof' }));

    expect(onContinue).not.toHaveBeenCalled();
    expect(screen.getByText('Include your ZIP code so we find the right home.')).toBeTruthy();
    expect(useBuild.getState().address).toBeNull();
  });

  it('a free-typed full address (with ZIP) still submits normally, with no placeId', () => {
    const onContinue = vi.fn();
    render(<StepAddress onContinue={onContinue} />);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: '123 Palm Ave, Tampa, FL 33602' } });
    fireEvent.click(screen.getByRole('button', { name: 'Build My Roof' }));

    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(useBuild.getState().address).toBe('123 Palm Ave, Tampa, FL 33602');
    expect(useBuild.getState().placeId).toBeNull();
  });

  it('editing the input after picking a suggestion drops the placeId, so a since-edited free-typed value is validated again', () => {
    const onContinue = vi.fn();
    render(<StepAddress onContinue={onContinue} />);

    // Simulate having picked a suggestion (no ZIP), then editing further --
    // any manual edit must invalidate the previously picked placeId.
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '8491 60th Street, Pinellas Park, FL, USA' } });
    fireEvent.click(screen.getByRole('button', { name: 'Build My Roof' }));

    // No placeId was ever picked here (only typed), so format validation
    // still applies and blocks the missing-ZIP text.
    expect(onContinue).not.toHaveBeenCalled();
    expect(screen.getByText('Include your ZIP code so we find the right home.')).toBeTruthy();
  });
});
