import { Angle } from '../geometry/angle.ts';
import {
  CSSProperties,
  forwardRef,
  MouseEventHandler,
  useCallback,
  useImperativeHandle
} from 'react';
import { Diagram, DiagramNode } from '../model-viewer/diagram.ts';
import { useRedraw } from './useRedraw.tsx';
import { Modifiers } from './drag.ts';
import { Point } from '../geometry/point.ts';
import { Rect } from './node-types/Rect.tsx';
import { Star } from './node-types/Star.tsx';
import { EditableDiagram } from '../model-editor/editable-diagram.ts';
import { RoundedRect } from './node-types/RoundedRect.tsx';

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

  const isSelected =
    props.diagram instanceof EditableDiagram &&
    props.diagram.selectionState.elements.includes(props.def);
  const isSingleSelected =
    isSelected &&
    props.diagram instanceof EditableDiagram &&
    props.diagram.selectionState.elements.length === 1;

  const onMouseDown = useCallback<MouseEventHandler>(
    e => {
      if (e.button !== 0) return;
      props.onMouseDown(props.def.id, Point.fromEvent(e.nativeEvent), e.nativeEvent);
      e.stopPropagation();

      return false;
    },
    [props]
  );

  const style: CSSProperties = {};
  if ((props.def.props?.highlight?.length ?? 0) > 0) {
    style.stroke = 'red';
  }

  if (props.def.nodeType === 'group') {
    return (
      <g
        onMouseEnter={() => props.onMouseEnter(props.def.id)}
        onMouseLeave={() => props.onMouseLeave(props.def.id)}
      >
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
            diagram={props.diagram}
            onMouseDown={(_id, coord, add) => props.onMouseDown(props.def.id, coord, add)}
            onMouseLeave={props.onMouseLeave}
            onMouseEnter={props.onMouseEnter}
          />
        ))}
      </g>
    );
  } else {
    return (
      <g
        transform={`rotate(${Angle.toDeg(props.def.bounds.rotation)} ${
          wx + props.def.bounds.size.w / 2
        } ${wy + props.def.bounds.size.h / 2})`}
        onMouseEnter={() => props.onMouseEnter(props.def.id)}
        onMouseLeave={() => props.onMouseLeave(props.def.id)}
      >
        {props.def.nodeType === 'rect' && (
          <Rect
            def={props.def}
            onMouseDown={onMouseDown}
            isSelected={isSelected}
            isSingleSelected={isSingleSelected}
            style={style}
          />
        )}
        {props.def.nodeType === 'star' && (
          <Star
            def={props.def}
            onMouseDown={onMouseDown}
            isSelected={isSelected}
            isSingleSelected={isSingleSelected}
            style={style}
          />
        )}
        {props.def.nodeType === 'rounded-rect' && (
          <RoundedRect
            def={props.def}
            onMouseDown={onMouseDown}
            isSelected={isSelected}
            isSingleSelected={isSingleSelected}
            style={style}
          />
        )}
      </g>
    );
  }
});

type Props = {
  def: DiagramNode;
  diagram: Diagram;
  onMouseDown: (id: string, coord: Point, modifiers: Modifiers) => void;
  onMouseEnter: (id: string) => void;
  onMouseLeave: (id: string) => void;
};
