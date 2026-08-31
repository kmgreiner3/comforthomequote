import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import StepSchedule from './StepSchedule';

// Feedback round 8, item 15: the window is tomorrow through today+7
// inclusive -- today itself is rejected, and (unlike before) there is now
// an upper bound too. A fixed system time keeps every date boundary in
// this file exact rather than racing the real clock.
const TODAY = new Date(2026, 8, 10); // September 10, 2026 (local)

function iso(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(TODAY);
});

afterEach(() => {
  vi.useRealTimers();
});

function fillAndSubmit(dateValue: string, windowLabel = 'Morning') {
  fireEvent.change(screen.getByLabelText('Visit date'), { target: { value: dateValue } });
  fireEvent.click(screen.getByText(windowLabel, { exact: true }));
  fireEvent.click(screen.getByRole('button', { name: 'Schedule My Visit' }));
}

describe('StepSchedule: date window (feedback round 8)', () => {
  it('shows the "within the next 7 days" hint', () => {
    render(<StepSchedule onContinue={vi.fn()} onBack={vi.fn()} />);
    expect(screen.getByText('Choose a date within the next 7 days.')).toBeTruthy();
  });

  it('rejects today', () => {
    const onContinue = vi.fn();
    render(<StepSchedule onContinue={onContinue} onBack={vi.fn()} />);

    fillAndSubmit(iso(2026, 9, 10));

    expect(screen.getByText('Choose a date within the next 7 days.')).toBeTruthy();
    expect(onContinue).not.toHaveBeenCalled();
  });

  it('accepts tomorrow (the earliest allowed day)', () => {
    const onContinue = vi.fn();
    render(<StepSchedule onContinue={onContinue} onBack={vi.fn()} />);

    fillAndSubmit(iso(2026, 9, 11));

    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('accepts today+7 (the latest allowed day)', () => {
    const onContinue = vi.fn();
    render(<StepSchedule onContinue={onContinue} onBack={vi.fn()} />);

    fillAndSubmit(iso(2026, 9, 17));

    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('rejects today+8 (past the new upper bound)', () => {
    const onContinue = vi.fn();
    render(<StepSchedule onContinue={onContinue} onBack={vi.fn()} />);

    fillAndSubmit(iso(2026, 9, 18));

    expect(screen.getByText('Choose a date within the next 7 days.')).toBeTruthy();
    expect(onContinue).not.toHaveBeenCalled();
  });
});
