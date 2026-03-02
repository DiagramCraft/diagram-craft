import { useCallback, useRef, useState } from 'react';

export const useRedraw = () => {
  const [, setRedraw] = useState(0);
  const pending = useRef(false);

  return useCallback(() => {
    if (pending.current) return;
    pending.current = true;
    queueMicrotask(() => {
      pending.current = false;
      setRedraw(r => r + 1);
    });
  }, []);
};
