import { useCallback, useEffect, useRef } from 'react';

type TimerId = number | null;

export const useCancellableTimeout = () => {
  const timerRef = useRef<TimerId>(null);

  const cancel = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const schedule = useCallback(
    (callback: () => void, delay = 0) => {
      cancel();
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        callback();
      }, delay);
    },
    [cancel]
  );

  useEffect(() => cancel, [cancel]);

  return { cancel, schedule };
};
