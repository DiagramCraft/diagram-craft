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
      props.onMouseDown(props.def.id, { x, y }, e.shiftKey);
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
          width={props.def.size.w}
          height={props.def.size.h}
          fill="transparent"
          style={{ stroke: 'transparent' }}
          onMouseDown={onMouseDown}
        />
        {props.def.children.map(c => (
          <Node
            key={c.id}
            def={c}
            isSelected={false}
            onMouseDown={(_id, coord, add) =>
              props.onMouseDown(props.def.id, { x: c.pos.x + coord.x, y: c.pos.y + coord.y }, add)
            }
          />
        ))}
      </>
    );
  } else {
    return (
      <rect
        x={wx}
        y={wy}
        width={props.def.size.w}
        height={props.def.size.h}
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
  onMouseDown: (id: string, coord: Coord, add: boolean) => void;
  isSelected: boolean;
};
