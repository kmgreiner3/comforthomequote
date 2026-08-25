import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useBuild } from '../../state/build';
import StepColor from './StepColor';

// jsdom does not implement matchMedia; motion/react's useReducedMotion()
// (used by RevealGroup/RevealItem, and StepColor's own description-panel
// AnimatePresence) reads it on every render. Stub it to report "reduced
// motion" so these tests are about selection/continue behavior, not
// animation timing.
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
});

function setup() {
  useBuild.getState().setOutline(2000);
  useBuild.getState().setShingle('iko-cambridge');
  const onContinue = vi.fn();
  const onBack = vi.fn();
  render(<StepColor onContinue={onContinue} onBack={onBack} />);
  return { onContinue, onBack };
}

describe('StepColor: selection never navigates', () => {
  it('Continue starts disabled with no color chosen', () => {
    setup();
    const continueButton = screen.getByRole('button', { name: 'Continue' }) as HTMLButtonElement;
    expect(continueButton.disabled).toBe(true);
  });

  it('selecting a swatch only selects it: store updates and the description panel updates, but onContinue is never called', () => {
    const { onContinue } = setup();

    fireEvent.click(screen.getByRole('button', { name: 'Dual Black' }));

    expect(useBuild.getState().color).toBe('Dual Black');
    expect(screen.getByTestId('color-description-name').textContent).toBe('Dual Black');
    expect(onContinue).not.toHaveBeenCalled();
    // Still on the color step: its heading is still rendered.
    expect(screen.getByText('Pick your color')).toBeTruthy();
  });

  it('Continue enables once a color is selected, and only then does clicking it call onContinue', () => {
    const { onContinue } = setup();

    fireEvent.click(screen.getByRole('button', { name: 'Dual Grey' }));

    const continueButton = screen.getByRole('button', { name: 'Continue' }) as HTMLButtonElement;
    expect(continueButton.disabled).toBe(false);
    expect(onContinue).not.toHaveBeenCalled();

    fireEvent.click(continueButton);
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('picking a different swatch afterward re-selects without ever auto-advancing', () => {
    const { onContinue } = setup();

    fireEvent.click(screen.getByRole('button', { name: 'Dual Black' }));
    expect(useBuild.getState().color).toBe('Dual Black');

    fireEvent.click(screen.getByRole('button', { name: 'Weatherwood' }));
    expect(useBuild.getState().color).toBe('Weatherwood');
    expect(onContinue).not.toHaveBeenCalled();
  });
});
