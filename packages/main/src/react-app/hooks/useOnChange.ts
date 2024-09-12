import { useRef } from 'react';

/**
 * A React hook that calls the provided `onChange` callback whenever the `value` changes.
 * The purpose of this hook is to provide an easy mechanism to monitor prop changes and,
 * as opposed to `useEffect`, run the on change callback
 *
 * @param value - The value to monitor for changes.
 * @param onChange - The callback function to call when the `value` changes.
 */
export const useOnChange = <T>(value: T, onChange: (value: T) => void) => {
  const lastValue = useRef<T | null>(null);

  if (lastValue.current !== value) {
    onChange(value);
    lastValue.current = value;
  }
};
