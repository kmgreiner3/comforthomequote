import { useEffect, useRef } from 'react';

const SELECT_ADVANCE_DELAY_MS = 420;

/**
 * For selection-style steps (shingle, color, underlayment, finishing):
 * choosing a card commits the decision (one decision per screen) and, after
 * a short beat so the selected/checked state is visible, advances to the
 * next step. Cleans up its timer on unmount so a quick Back doesn't fire a
 * stray navigation later.
 */
export function useDelayedContinue(onContinue: () => void) {
  const timeoutRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current != null) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  return function trigger() {
    if (timeoutRef.current != null) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(onContinue, SELECT_ADVANCE_DELAY_MS);
  };
}
