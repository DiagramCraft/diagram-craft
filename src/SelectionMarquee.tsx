import { forwardRef, useImperativeHandle } from 'react';
import { SelectionState } from './state.ts';
import { useRedraw } from './useRedraw.tsx';

export type SelectionMarqueeApi = {
  repaint: () => void;
};

export const SelectionMarquee = forwardRef<SelectionMarqueeApi, Props>((props, ref) => {
  const redraw = useRedraw();

  useImperativeHandle(ref, () => {
    return {
      repaint: () => {
        redraw();
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
