import { Coord } from './types.ts';
import { forwardRef, useImperativeHandle, useState } from 'react';
import { NodeDef } from './diagram.ts';

export type NodeApi = {
  repaint: () => void;
};

export const Node = forwardRef<NodeApi, Props>((props, ref) => {
  const [redraw, setRedraw] = useState(1);

  useImperativeHandle(ref, () => {
    return {
      repaint: () => {
        setRedraw(redraw + 1);
      }
    };
  });

  return (
    <rect
      x={props.def.x}
      y={props.def.y}
      width={props.def.w}
      height={props.def.h}
      fill="#ffccff"
      style={{ stroke: 'black', strokeWidth: props.isSelected ? '6' : '2' }}
      rx="5"
      ry="5"
      onMouseDown={e => {
        const x = e.nativeEvent.offsetX - props.def.x;
        const y = e.nativeEvent.offsetY - props.def.y;
        props.onMouseDown(props.id, { x, y });
        e.stopPropagation();

        return false;
      }}
    />
  );
});

type Props = {
  id: string;
  def: NodeDef;
  onMouseDown: (id: string, coord: Coord) => void;
  isSelected: boolean;
};
