import { Angle } from '../geometry/angle.ts';
import {
  CSSProperties,
  forwardRef,
  MouseEventHandler,
  SVGProps,
  useCallback,
  useImperativeHandle
} from 'react';
import { Diagram, DiagramNode } from '../model-viewer/diagram.ts';
import { useRedraw } from './useRedraw.tsx';
import { Modifiers } from '../base-ui/drag.ts';
import { Point } from '../geometry/point.ts';
import { EditableDiagram } from '../model-editor/editable-diagram.ts';
import { VERIFY_NOT_REACHED } from '../utils/assert.ts';
import { ReactNodeDefinition } from './reactNodeDefinition.ts';
import { getPoint } from './eventHelper.ts';

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

      props.onMouseDown(props.def.id, getPoint(e, props.diagram), e.nativeEvent);
      e.stopPropagation();

      return false;
    },
    [props]
  );

  const style: CSSProperties = {};
  if (props.def.props?.highlight?.includes('edge-connect')) {
    style.stroke = 'red';
  }

  if (props.def.props?.fill?.color) {
    style.fill = props.def.props?.fill?.color;
  }

  if (props.def.props?.stroke?.color) {
    style.stroke = props.def.props?.stroke?.color;
  }

  style.fill = 'transparent';

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
    const nodeDef = props.diagram.nodDefinitions.get(props.def.nodeType);

    // TODO: Better error handling here
    if (!nodeDef) VERIFY_NOT_REACHED();
    if (!('reactNode' in nodeDef)) VERIFY_NOT_REACHED();

    const ReactNodeImpl = (nodeDef as ReactNodeDefinition).reactNode;

    return (
      <g
        id={`node-${props.def.id}`}
        transform={`rotate(${Angle.toDeg(props.def.bounds.rotation)} ${
          wx + props.def.bounds.size.w / 2
        } ${wy + props.def.bounds.size.h / 2})`}
        onMouseEnter={() => props.onMouseEnter(props.def.id)}
        onMouseLeave={() => props.onMouseLeave(props.def.id)}
      >
        <ReactNodeImpl
          def={nodeDef}
          node={props.def}
          onMouseDown={onMouseDown}
          isSelected={isSelected}
          isSingleSelected={isSingleSelected}
          style={style}
        />

        {props.def.props.highlight?.includes('edge-connect') && (
          <>
            {props.def.anchors.map(anchor => (
              <circle
                key={`${anchor.x}_${anchor.y}`}
                cx={props.def.bounds.pos.x + anchor.x * props.def.bounds.size.w}
                cy={props.def.bounds.pos.y + anchor.y * props.def.bounds.size.h}
                r={5}
                stroke="red"
                fill={'transparent'}
              />
            ))}
          </>
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
} & Omit<
  SVGProps<SVGGElement>,
  'id' | 'transform' | 'onMouseEnter' | 'onMouseMove' | 'onMouseDown'
>;
