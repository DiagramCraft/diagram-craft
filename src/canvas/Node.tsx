import { Angle } from '../geometry/angle.ts';
import { forwardRef, MouseEventHandler, useCallback, useImperativeHandle } from 'react';
import { ResolvedNodeDef } from '../model-viewer/diagram.ts';
import { useRedraw } from './useRedraw.tsx';
import { Modifiers } from './drag.ts';
import { Point } from '../geometry/point.ts';

export type NodeApi = {
  repaint: () => void;
};

export const Node = forwardRef<NodeApi, Props>((props, ref) => {
  const redraw = useRedraw();

  useImperativeHandle(ref, () => {
    return {
      repaint: () => {
        redraw();
      }
    };
  });

  const wx = props.def.bounds.pos.x;
  const wy = props.def.bounds.pos.y;

  const onMouseDown = useCallback<MouseEventHandler>(
    e => {
      props.onMouseDown(props.def.id, Point.fromEvent(e.nativeEvent), e.nativeEvent);
      e.stopPropagation();

      return false;
    },
    [props]
  );

  if (props.def.nodeType === 'group') {
    return (
      <g>
        {/* TODO: Probably remove the rect here? */}
        <rect
          x={wx}
          y={wy}
          width={props.def.bounds.size.w}
          height={props.def.bounds.size.h}
          fill="transparent"
          style={{ stroke: 'green' }}
          onMouseDown={onMouseDown}
          transform={`rotate(${Angle.toDeg(props.def.bounds.rotation)} ${
            wx + props.def.bounds.size.w / 2
          } ${wy + props.def.bounds.size.h / 2})`}
        />
        {props.def.children.map(c => (
          <Node
            key={c.id}
            def={c}
            isSelected={false}
            onMouseDown={(_id, coord, add) => props.onMouseDown(props.def.id, coord, add)}
          />
        ))}

        {/*<text
          x={wx + props.def.size.w / 2}
          y={wy + props.def.size.h / 2}
          fill="black"
          style={{ fontSize: '10px' }}
          dominantBaseline="middle"
          textAnchor="middle"
        >
          {wx}, {wy} {props.def.size.w}x{props.def.size.h} rot{Math.round(props.def.rotation)}
        </text>*/}
      </g>
    );
  } else {
    return (
      <g
        transform={`rotate(${Angle.toDeg(props.def.bounds.rotation)} ${
          wx + props.def.bounds.size.w / 2
        } ${wy + props.def.bounds.size.h / 2})`}
      >
        <rect
          x={wx}
          y={wy}
          width={props.def.bounds.size.w}
          height={props.def.bounds.size.h}
          fill="#ffccff"
          style={{ stroke: 'black', strokeWidth: '1' }}
          rx="5"
          ry="5"
          onMouseDown={onMouseDown}
        />

        {/*
        <text
          x={wx + props.def.size.w / 2}
          y={wy + props.def.size.h / 2}
          fill="black"
          style={{ fontSize: '10px' }}
          dominantBaseline="middle"
          textAnchor="middle"
        >
          {Math.round(wx)}, {Math.round(wy)} {props.def.size.w}x{props.def.size.h} rot
          {Math.round(props.def.rotation)}
        </text>
        */}
      </g>
    );
  }
});

type Props = {
  def: ResolvedNodeDef;
  onMouseDown: (id: string, coord: Point, modifiers: Modifiers) => void;
  isSelected: boolean;
};
