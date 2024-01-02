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
import { precondition } from '../utils/assert.ts';
import { ReactNodeDefinition } from './reactNodeDefinition.ts';
import { DASH_PATTERNS } from '../base-ui/dashPatterns.ts';
import { DiagramNode } from '../model/diagramNode.ts';
import { useConfiguration } from '../react-app/context/ConfigurationContext.tsx';
import { deepMerge } from '../utils/deepmerge.ts';
import { makeShadowFilter } from '../base-ui/styleUtils.ts';
import { EventHelper } from '../base-ui/eventHelper.ts';
import { DeepRequired } from 'ts-essentials';
import { Box } from '../geometry/box.ts';

export type NodeApi = {
  repaint: () => void;
};

export const Node = forwardRef<NodeApi, Props>((props, ref) => {
  const redraw = useRedraw();

  const { defaults } = useConfiguration();

  useImperativeHandle(ref, () => ({ repaint: redraw }));

  const onMouseDown = useCallback<MouseEventHandler>(
    e => {
      if (e.button !== 0) return;

      const target = document.getElementById(`diagram-${props.diagram.id}`) as HTMLElement;
      if (!target) return;
      props.onMouseDown(
        props.def.id,
        EventHelper.pointWithRespectTo(e.nativeEvent, target),
        e.nativeEvent
      );
      e.stopPropagation();
    },
    [props]
  );

  const nodeDef = props.diagram.nodeDefinitions.get(props.def.nodeType);

  const nodeProps = deepMerge(
    {},
    defaults.node,
    nodeDef.getDefaultProps(props.mode ?? 'canvas'),
    props.def.props
  ) as DeepRequired<NodeProps>;

  const center = Box.center(props.def.bounds);

  const isSelected = props.diagram.selectionState.elements.includes(props.def);
  const isSingleSelected = isSelected && props.diagram.selectionState.elements.length === 1;
  const isEdgeConnect = nodeProps.highlight?.includes('edge-connect');

  const style: CSSProperties = {
    fill: nodeProps.fill.color,
    strokeWidth: nodeProps.stroke.width,
    stroke: isEdgeConnect ? 'red' : nodeProps.stroke.color
  };

  if (nodeProps?.fill?.type === 'gradient') {
    style.fill = `url(#node-${props.def.id}-gradient)`;
  }

  if (nodeProps.stroke?.pattern) {
    style.strokeDasharray = DASH_PATTERNS[nodeProps.stroke.pattern](
      (nodeProps.stroke.patternSize ?? 100) / 100,
      (nodeProps.stroke.patternSpacing ?? 100) / 100
    );
  }

  if (nodeProps.shadow.enabled) {
    style.filter = makeShadowFilter(nodeProps.shadow);
  }

  if (nodeProps.stroke.enabled === false) {
    style.stroke = 'transparent';
    style.strokeWidth = 0;
  }

  if (nodeProps.fill.enabled === false) {
    style.fill = 'transparent';
  }

  // TODO: Better error handling here
  precondition.is.true(nodeDef && 'reactNode' in nodeDef);

  const ReactNodeImpl = (nodeDef as ReactNodeDefinition).reactNode;

  // TODO: We should only apply the rotation to leaf nodes and not to groups or containers
  //       ... changing this likely means changing Node.tsx and Container.tsx
  //       ... or maybe it's better to continue like this with reverse rotations in Node and Container
  return (
    <g
      id={`node-${props.def.id}`}
      className={'svg-node'}
      transform={`rotate(${Angle.toDeg(props.def.bounds.rotation)} ${center.x} ${center.y})`}
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
        childProps={{
          onMouseDown: props.onMouseDown,
          onMouseEnter: props.onMouseEnter,
          onMouseLeave: props.onMouseLeave,
          onDoubleClick: props.onDoubleClick
        }}
      />

      {isEdgeConnect && (
        <g transform={`rotate(${-Angle.toDeg(props.def.bounds.rotation)} ${center.x} ${center.y})`}>
          {props.def.anchors.map(anchor => (
            <circle
              key={`${anchor.point.x}_${anchor.point.y}`}
              className={'svg-node__anchor'}
              cx={props.def.bounds.pos.x + anchor.point.x * props.def.bounds.size.w}
              cy={props.def.bounds.pos.y + anchor.point.y * props.def.bounds.size.h}
              r={5}
            />
          ))}
        </g>
      )}
    </g>
  );
});

type Props = {
  def: DiagramNode;
  diagram: Diagram;
  onMouseDown: (id: string, coord: Point, modifiers: Modifiers) => void;
  onMouseEnter: (id: string) => void;
  onMouseLeave: (id: string) => void;
  onDoubleClick?: (id: string, coord: Point) => void;
  mode?: 'picker' | 'canvas';
} & Omit<
  SVGProps<SVGGElement>,
  | 'id'
  | 'transform'
  | 'onMouseMove'
  | 'onMouseEnter'
  | 'onMouseDown'
  | 'onMouseLeave'
  | 'onDoubleClick'
>;
