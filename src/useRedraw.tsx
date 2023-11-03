import { useState } from 'react';

export const useRedraw = () => {
  const [redraw, setRedraw] = useState(1);
  return () => {
    setRedraw(redraw + 1);
  };
};
