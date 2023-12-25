import { Angle } from '../geometry/angle.ts';
import {
  CSSProperties,
  forwardRef,
  MouseEventHandler,
  SVGProps,
  useCallback,
  useImperativeHandle
} from 'react';
import { Diagram } from '../model/diagram.ts';
import { useRedraw } from './useRedraw.tsx';
import { Modifiers } from '../base-ui/drag/dragDropManager.ts';
import { Point } from '../geometry/point.ts';
import { VERIFY_NOT_REACHED } from '../utils/assert.ts';
import { ReactNodeDefinition } from './reactNodeDefinition.ts';
import { getPoint } from './eventHelper.ts';
import { DASH_PATTERNS } from '../base-ui/dashPatterns.ts';
import { DiagramNode } from '../model/diagramNode.ts';
import { useConfiguration } from '../react-app/context/ConfigurationContext.tsx';
import { deepMerge } from '../utils/deepmerge.ts';
import { makeShadowFilter } from '../base-ui/styleUtils.ts';

export type NodeApi = {
  repaint: () => void;
};

export const Node = forwardRef<NodeApi, Props>((props, ref) => {
  const redraw = useRedraw();

  const { defaults } = useConfiguration();

  useImperativeHandle(ref, () => {
    return {
      repaint: () => {
        redraw();
      }
    };
  });

  const wx = props.def.bounds.pos.x;
  const wy = props.def.bounds.pos.y;

  const isSelected = props.diagram.selectionState.elements.includes(props.def);
  const isSingleSelected = isSelected && props.diagram.selectionState.elements.length === 1;

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

  const nodeDef = props.diagram.nodeDefinitions.get(props.def.nodeType);

  const nodeProps: NodeProps = deepMerge(
    {},
    defaults?.node ?? {},
    nodeDef.getDefaultProps(props.mode ?? 'canvas'),
    props.def.props
  );

  style.fill = nodeProps?.fill?.color ?? 'none';
  style.stroke = nodeProps?.stroke?.color ?? 'none';
  style.strokeWidth = nodeProps?.stroke?.width ?? 1;

  if (nodeProps?.fill?.type === 'gradient') {
    style.fill = `url(#node-${props.def.id}-gradient)`;
  }

  if (nodeProps.stroke?.pattern) {
    style.strokeDasharray =
      DASH_PATTERNS[nodeProps.stroke?.pattern ?? 'SOLID']?.(
        (nodeProps.stroke?.patternSize ?? 100) / 100,
        (nodeProps.stroke?.patternSpacing ?? 100) / 100
      ) ?? '';
  }

  if (nodeProps.shadow?.enabled) {
    style.filter = makeShadowFilter(nodeProps.shadow);
  }

  if (nodeProps.stroke?.enabled === false) {
    style.stroke = 'transparent';
    style.strokeWidth = 0;
  }

  if (nodeProps.fill?.enabled === false) {
    style.fill = 'transparent';
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
    // TODO: Better error handling here
    if (!nodeDef) VERIFY_NOT_REACHED();
    if (!('reactNode' in nodeDef)) VERIFY_NOT_REACHED();

    const ReactNodeImpl = (nodeDef as ReactNodeDefinition).reactNode;

    return (
      <>
        <g
          id={`node-${props.def.id}`}
          transform={`rotate(${Angle.toDeg(props.def.bounds.rotation)} ${
            wx + props.def.bounds.size.w / 2
          } ${wy + props.def.bounds.size.h / 2})`}
          onMouseEnter={() => props.onMouseEnter(props.def.id)}
          onMouseLeave={() => props.onMouseLeave(props.def.id)}
        >
          {nodeProps.fill?.type === 'gradient' && (
            <linearGradient id={`node-${props.def.id}-gradient`}>
              <stop stopColor={nodeProps.fill.color} offset="0%" />
              <stop stopColor={nodeProps.fill.color2} offset="100%" />
            </linearGradient>
          )}
          <ReactNodeImpl
            def={nodeDef}
            diagram={props.diagram}
            node={props.def}
            nodeProps={nodeProps}
            onMouseDown={onMouseDown}
            isSelected={isSelected}
            isSingleSelected={isSingleSelected}
            style={style}
          />

          {nodeProps.highlight?.includes('edge-connect') && (
            <g
              transform={`rotate(${-Angle.toDeg(props.def.bounds.rotation)} ${
                wx + props.def.bounds.size.w / 2
              } ${wy + props.def.bounds.size.h / 2})`}
            >
              {props.def.anchors.map(anchor => (
                <circle
                  key={`${anchor.point.x}_${anchor.point.y}`}
                  cx={props.def.bounds.pos.x + anchor.point.x * props.def.bounds.size.w}
                  cy={props.def.bounds.pos.y + anchor.point.y * props.def.bounds.size.h}
                  r={5}
                  stroke="red"
                  fill={'transparent'}
                />
              ))}
            </g>
          )}
        </g>
      </>
    );
  }
});

type Props = {
  def: DiagramNode;
  diagram: Diagram;
  onMouseDown: (id: string, coord: Point, modifiers: Modifiers) => void;
  onMouseEnter: (id: string) => void;
  onMouseLeave: (id: string) => void;
  mode?: 'picker' | 'canvas';
} & Omit<
  SVGProps<SVGGElement>,
  'id' | 'transform' | 'onMouseEnter' | 'onMouseMove' | 'onMouseDown'
>;
