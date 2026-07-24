import { type RefObject, useEffect, useRef } from 'react';
import { useCancellableTimeout } from './useCancellableTimeout';

type AutoFocusOptions<T extends HTMLElement> = {
  enabled?: boolean;
  delay?: number;
  trigger?: unknown;
  onFocused?: (element: T) => void;
};

export const useAutoFocus = <T extends HTMLElement>(
  ref: RefObject<T | null>,
  { enabled = true, delay = 0, trigger, onFocused }: AutoFocusOptions<T> = {}
) => {
  const onFocusedRef = useRef(onFocused);
  onFocusedRef.current = onFocused;

  const { cancel, schedule } = useCancellableTimeout();

  // biome-ignore lint/correctness/useExhaustiveDependencies: trigger intentionally reschedules focus
  useEffect(() => {
    if (!enabled) {
      cancel();
      return;
    }

    schedule(() => {
      const element = ref.current;
      if (!element) return;

      element.focus();
      onFocusedRef.current?.(element);
    }, delay);

    return cancel;
  }, [cancel, delay, enabled, ref, schedule, trigger]);
};
