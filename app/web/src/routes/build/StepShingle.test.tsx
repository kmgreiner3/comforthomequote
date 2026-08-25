import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useBuild } from '../../state/build';
import StepShingle from './StepShingle';

// jsdom does not implement matchMedia; motion/react's useReducedMotion()
// (used by RevealGroup/RevealItem) reads it on every render. Stub it to
// report "reduced motion" so steps render as plain inert divs -- these
// tests are about selection/continue behavior, not animation timing.
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
  const onContinue = vi.fn();
  const onBack = vi.fn();
  render(<StepShingle onContinue={onContinue} onBack={onBack} />);
  return { onContinue, onBack };
}

describe('StepShingle: selection never navigates', () => {
  it('Continue starts disabled with no shingle chosen', () => {
    setup();
    const continueButton = screen.getByRole('button', { name: 'Continue' }) as HTMLButtonElement;
    expect(continueButton.disabled).toBe(true);
  });

  it('selecting a card only selects it: store updates, but onContinue is never called and the step stays put', () => {
    const { onContinue } = setup();

    fireEvent.click(screen.getByText('TAMKO Titan XT'));

    expect(useBuild.getState().shingle).toBe('tamko-titan-xt');
    expect(onContinue).not.toHaveBeenCalled();
    // Still on the shingle step: its heading is still rendered.
    expect(screen.getByText('Choose your shingle')).toBeTruthy();
  });

  it('Continue enables once a shingle is selected, and only then does clicking it call onContinue', () => {
    const { onContinue } = setup();

    fireEvent.click(screen.getByText('IKO Cambridge'));

    const continueButton = screen.getByRole('button', { name: 'Continue' }) as HTMLButtonElement;
    expect(continueButton.disabled).toBe(false);
    expect(onContinue).not.toHaveBeenCalled();

    fireEvent.click(continueButton);
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('selecting the other card afterward re-selects without ever auto-advancing', () => {
    const { onContinue } = setup();

    fireEvent.click(screen.getByText('IKO Cambridge'));
    expect(useBuild.getState().shingle).toBe('iko-cambridge');

    fireEvent.click(screen.getByText('TAMKO Titan XT'));
    expect(useBuild.getState().shingle).toBe('tamko-titan-xt');
    expect(onContinue).not.toHaveBeenCalled();

    cleanup();
  });
});
