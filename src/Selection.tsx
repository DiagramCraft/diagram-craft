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

  const wx = props.selection.pos.x;
  const wy = props.selection.pos.y;

  return (
    <rect
      x={props.selection.pos.x}
      y={props.selection.pos.y}
      width={props.selection.size.w}
      height={props.selection.size.h}
      fill="transparent"
      style={{ stroke: 'red', strokeWidth: '5' }}
      onMouseDown={e => {
        const x = e.nativeEvent.offsetX - wx;
        const y = e.nativeEvent.offsetY - wy;
        props.onMouseDown({ x, y });
        e.stopPropagation();
      }}
    />
  );
});

type Props = {
  selection: SelectionState;
  onMouseDown: (c: Coord) => void;
};
