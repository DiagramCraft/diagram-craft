import { forwardRef, useImperativeHandle, useState } from 'react';
import { Box } from './geometry.ts';

export type SelectionMarqueeApi = {
  repaint: (b: Box) => void;
  clear: () => void;
};

// TODO: We should keep a state variable for this instead of using the redraw hack.
export const SelectionMarquee = forwardRef<SelectionMarqueeApi, Props>((_props, ref) => {
  const [redraw, setRedraw] = useState(1);
  const [box, setBox] = useState<Box | null>(null);

  useImperativeHandle(ref, () => {
    return {
      repaint: (b: Box) => {
        setBox(Box.normalize(b));
        setRedraw(redraw + 1);
      },
      clear: () => {
        setBox(null);
        setRedraw(redraw + 1);
      }
    };
  });

  if (!box) return null;

  return (
    <rect
      x={box.pos.x}
      y={box.pos.y}
      width={box.size.w}
      height={box.size.h}
      fill="rgba(0, 255, 0, 0.2)"
      style={{ stroke: 'green' }}
    />
  );
});

type Props = {
  dummy?: string;
};
