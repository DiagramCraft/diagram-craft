import { useEffect, useState } from 'react';

/**
 * Returns `true` only once `active` has stayed `true` for `delayMs` without interruption - so a
 * loading state that resolves quickly never shows its spinner/placeholder, avoiding flicker.
 * Resets immediately when `active` goes `false`.
 */
export const useDelayedFlag = (active: boolean, delayMs: number): boolean => {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!active) {
      setShown(false);
      return;
    }
    const timer = setTimeout(() => setShown(true), delayMs);
    return () => clearTimeout(timer);
  }, [active, delayMs]);

  return shown;
};
