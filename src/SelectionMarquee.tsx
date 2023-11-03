import { forwardRef, useImperativeHandle, useState } from 'react';
import { SelectionState } from './state.ts';

export type SelectionMarqueeApi = {
  repaint: () => void;
};

export const SelectionMarquee = forwardRef<SelectionMarqueeApi, Props>((props, ref) => {
  const [redraw, setRedraw] = useState(1);

  useImperativeHandle(ref, () => {
    return {
      repaint: () => {
        setRedraw(redraw + 1);
      }
    };
  });

  if (!props.selection.marquee) return null;

  return (
    <rect
      x={props.selection.marquee.pos.x}
      y={props.selection.marquee.pos.y}
      width={props.selection.marquee.size.w}
      height={props.selection.marquee.size.h}
      fill="rgba(0, 255, 0, 0.2)"
      style={{ stroke: 'green' }}
    />
  );
});

type Props = {
  selection: SelectionState;
};
