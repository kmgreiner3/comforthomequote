import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useBuild } from '../../state/build';
import StepAppearance from './StepAppearance';

// jsdom does not implement matchMedia; motion/react's useReducedMotion()
// (used by RevealGroup/RevealItem, and the description panel's own
// AnimatePresence) reads it on every render, as does useIsDesktop() (used to
// pick the desktop sticky-panel layout vs. the mobile inline-expand one).
// Stubbing it to always report "matches" lands these tests on the desktop
// branch, reduced-motion -- selection/gating behavior is identical either
// way, so that's the one worth asserting against here.
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
  render(<StepAppearance onContinue={onContinue} onBack={onBack} />);
  return { onContinue, onBack };
}

describe('StepAppearance: color selection never navigates', () => {
  it('Continue starts disabled with neither color nor drip edge chosen', () => {
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
    expect(screen.getByText('Choose your color and finish')).toBeTruthy();
  });

  it('picking a different swatch afterward re-selects without ever auto-advancing', () => {
    const { onContinue } = setup();

    fireEvent.click(screen.getByRole('button', { name: 'Dual Black' }));
    expect(useBuild.getState().color).toBe('Dual Black');

    fireEvent.click(screen.getByRole('button', { name: 'Weatherwood' }));
    expect(useBuild.getState().color).toBe('Weatherwood');
    expect(onContinue).not.toHaveBeenCalled();
  });

  it('Continue stays disabled once a color is chosen but no drip edge yet', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Dual Black' }));

    const continueButton = screen.getByRole('button', { name: 'Continue' }) as HTMLButtonElement;
    expect(continueButton.disabled).toBe(true);
  });
});

describe('StepAppearance: drip edge gates Continue', () => {
  it('Continue enables only once both a color and a drip edge are chosen, and only then does clicking it call onContinue', () => {
    const { onContinue } = setup();

    fireEvent.click(screen.getByRole('button', { name: 'Dual Grey' }));
    fireEvent.click(screen.getByRole('button', { name: 'Black' }));

    const continueButton = screen.getByRole('button', { name: 'Continue' }) as HTMLButtonElement;
    expect(continueButton.disabled).toBe(false);
    expect(onContinue).not.toHaveBeenCalled();

    fireEvent.click(continueButton);
    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(useBuild.getState().dripEdge).toBe('Black');
  });

  it('selecting a drip edge does not itself navigate', () => {
    const { onContinue } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Dual Grey' }));

    fireEvent.click(screen.getByRole('button', { name: 'White' }));

    expect(useBuild.getState().dripEdge).toBe('White');
    expect(onContinue).not.toHaveBeenCalled();
  });
});
