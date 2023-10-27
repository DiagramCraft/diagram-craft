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

  // TODO: Will this work with two level nesting?
  const baseX = props.def.parent?.x ?? 0;
  const baseY = props.def.parent?.y ?? 0;

  const wx = baseX + props.def.x;
  const wy = baseY + props.def.y;


  const onMouseDown = useCallback<MouseEventHandler>(
    e => {
      const x = e.nativeEvent.offsetX - wx;
      const y = e.nativeEvent.offsetY - wy;
      props.onMouseDown(props.id, { x, y });
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
          style={{ stroke: props.isSelected ? 'blue' : 'transparent', strokeWidth: '1' }}
          onMouseDown={onMouseDown}
        />
        {props.def.children.map(c => (
          <Node
            key={c.id}
            id={c.id}
            def={c}
            isSelected={false}
            onMouseDown={(_id, coord) => props.onMouseDown(props.id, { x: baseX + c.x + coord.x, y: baseY + c.y + coord.y })}
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
        style={{ stroke: 'black', strokeWidth: props.isSelected ? '6' : '2' }}
        rx="5"
        ry="5"
        onMouseDown={onMouseDown}
      />
    );
  }
});

type Props = {
  id: string;
  def: ResolvedNodeDef;
  onMouseDown: (id: string, coord: Coord) => void;
  isSelected: boolean;
};
