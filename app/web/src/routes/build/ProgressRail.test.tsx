import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import ProgressRail from './ProgressRail';

// Feedback round 8: the 9-step flow collapsed to 5 -- home, shingle,
// appearance, included, review (indices 0-4).
describe('ProgressRail: earned-step navigation', () => {
  it('renders earned steps as enabled buttons and unearned steps as disabled buttons', () => {
    const onStepClick = vi.fn();
    render(
      <ProgressRail
        currentIndex={1}
        maxAllowedIndex={2}
        onStepClick={onStepClick}
        onStartOver={vi.fn()}
      />
    );

    // Earned (home, shingle, appearance -- indices 0-2): real, enabled buttons.
    const appearanceButton = screen.getByRole('button', { name: 'Go to Appearance step' }) as HTMLButtonElement;
    expect(appearanceButton.disabled).toBe(false);
    expect(appearanceButton.tagName).toBe('BUTTON');

    // Unearned (included and beyond -- index 3+): disabled buttons, not divs.
    const includedButton = screen.getByRole('button', { name: 'Go to Included step' }) as HTMLButtonElement;
    expect(includedButton.disabled).toBe(true);
    expect(includedButton.tagName).toBe('BUTTON');
  });

  it('marks the current step distinctly via aria-current', () => {
    render(
      <ProgressRail currentIndex={2} maxAllowedIndex={4} onStepClick={vi.fn()} onStartOver={vi.fn()} />
    );

    const currentButton = screen.getByRole('button', { name: 'Go to Appearance step' });
    expect(currentButton.getAttribute('aria-current')).toBe('step');

    const otherButton = screen.getByRole('button', { name: 'Go to Home step' });
    expect(otherButton.getAttribute('aria-current')).toBeNull();
  });

  it('clicking an earned step button calls onStepClick with that step id', () => {
    const onStepClick = vi.fn();
    render(
      <ProgressRail
        currentIndex={0}
        maxAllowedIndex={3}
        onStepClick={onStepClick}
        onStartOver={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Go to Appearance step' }));
    expect(onStepClick).toHaveBeenCalledWith('appearance');
  });

  it('clicking a disabled (unearned) step button never calls onStepClick', () => {
    const onStepClick = vi.fn();
    render(
      <ProgressRail
        currentIndex={0}
        maxAllowedIndex={0}
        onStepClick={onStepClick}
        onStartOver={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Go to Review step' }));
    expect(onStepClick).not.toHaveBeenCalled();
  });

  it('the rail "Start over" link requires an inline confirm before calling onStartOver', () => {
    const onStartOver = vi.fn();
    render(
      <ProgressRail currentIndex={0} maxAllowedIndex={0} onStepClick={vi.fn()} onStartOver={onStartOver} />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Start over' }));
    expect(onStartOver).not.toHaveBeenCalled();
    expect(screen.getByText('Clear this quote and start fresh?')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Yes, start over' }));
    expect(onStartOver).toHaveBeenCalledTimes(1);
  });
});
