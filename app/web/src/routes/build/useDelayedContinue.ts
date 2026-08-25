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
  // Typed as `number` (not ReturnType<typeof window.setTimeout>): the browser
  // DOM lib and @types/node both declare global setTimeout overloads, and
  // once both are on the program (Node types can get pulled in transitively
  // by other workspaces' tooling) that ReturnType derivation picks Node's
  // Timeout overload while the actual `window.setTimeout` call still returns
  // a number, so the two disagree in a way that only DOM's does not.
  const timeoutRef = useRef<number | null>(null);

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
