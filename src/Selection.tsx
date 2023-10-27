import { Coord } from './types.ts';
import { forwardRef, useImperativeHandle, useState } from 'react';
import { SelectionState } from './state.ts';

export type SelectionApi = {
  repaint: () => void;
};

export const Selection = forwardRef<SelectionApi, Props>((props, ref) => {
  const [redraw, setRedraw] = useState(1);

  useImperativeHandle(ref, () => {
    return {
      repaint: () => {
        setRedraw(redraw + 1);
      }
    };
  });

  const points: Coord[] = [
    props.selection.pos,
    { x: props.selection.pos.x + props.selection.size.w, y: props.selection.pos.y },
    {
      x: props.selection.pos.x + props.selection.size.w,
      y: props.selection.pos.y + props.selection.size.h
    },
    { x: props.selection.pos.x, y: props.selection.pos.y + props.selection.size.h },
    props.selection.pos
  ];
  const pointsString = points.map(c => `${c.x},${c.y}`).join(' ');

  return <polyline points={pointsString} style={{ stroke: 'red', strokeWidth: '5' }} fill="none" />;
});

type Props = {
  selection: SelectionState;
};
