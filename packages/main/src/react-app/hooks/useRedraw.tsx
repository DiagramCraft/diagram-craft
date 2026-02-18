import { useCallback, useState } from 'react';

export const useRedraw = () => {
  const [_redraw, setRedraw] = useState(1);
  return useCallback(() => {
    queueMicrotask(() => setRedraw(redraw => redraw + 1));
  }, []);
};
