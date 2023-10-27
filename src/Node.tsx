import { Coord } from './types.ts';
import { forwardRef, MouseEventHandler, useCallback, useImperativeHandle, useState } from 'react';
import { ResolvedNodeDef } from './diagram.ts';

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

  const wx = props.def.world.x;
  const wy = props.def.world.y;

  const onMouseDown = useCallback<MouseEventHandler>(
    e => {
      const x = e.nativeEvent.offsetX - wx;
      const y = e.nativeEvent.offsetY - wy;
      props.onMouseDown(props.def.id, { x, y });
      e.stopPropagation();

      return false;
    },
    [props, wx, wy]
  );

  if (props.def.nodeType === 'group') {
    return (
      <>
        <rect
          x={wx}
          y={wy}
          width={props.def.w}
          height={props.def.h}
          fill="transparent"
          style={{ stroke: 'transparent' }}
          onMouseDown={onMouseDown}
        />
        {props.def.children.map(c => (
          <Node
            key={c.id}
            def={c}
            isSelected={false}
            onMouseDown={(_id, coord) => props.onMouseDown(props.def.id, { x: c.x + coord.x, y: c.y + coord.y })}
          />
        ))}
      </>
    );
  } else {
    return (
      <rect
        x={wx}
        y={wy}
        width={props.def.w}
        height={props.def.h}
        fill="#ffccff"
        style={{ stroke: 'black', strokeWidth: '1' }}
        rx="5"
        ry="5"
        onMouseDown={onMouseDown}
      />
    );
  }
});

type Props = {
  def: ResolvedNodeDef;
  onMouseDown: (id: string, coord: Coord) => void;
  isSelected: boolean;
};
