import { useCallback, useState } from 'react';

export const useRedraw = () => {
  const [, setRedraw] = useState(0);

  return useCallback(() => setRedraw(r => r + 1), []);
};
