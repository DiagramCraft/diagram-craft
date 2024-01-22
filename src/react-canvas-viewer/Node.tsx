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
import { ReactNodeDefinition } from './reactNodeDefinition.ts';
import { DASH_PATTERNS } from '../base-ui/dashPatterns.ts';
import { DiagramNode } from '../model/diagramNode.ts';
import { makeShadowFilter } from '../base-ui/styleUtils.ts';
import { EventHelper } from '../base-ui/eventHelper.ts';
import { Box } from '../geometry/box.ts';
import { ApplicationTriggers } from '../react-canvas-editor/EditableCanvas.tsx';
import { Tool } from '../react-canvas-editor/tools/types.ts';
import { NodePattern } from './NodePattern.tsx';
import { NodeFilter } from './NodeFilter.tsx';

export type NodeApi = {
  repaint: () => void;
};

export const Node = forwardRef<NodeApi, Props>((props, ref) => {
  const $d = props.diagram;
  const redraw = useRedraw();

  useImperativeHandle(ref, () => ({ repaint: redraw }));

  const onMouseDown = useCallback<MouseEventHandler>(
    e => {
      if (e.button !== 0) return;

      const target = document.getElementById(`diagram-${$d.id}`) as HTMLElement | undefined;
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

  const nodeDef = $d.nodeDefinitions.get(props.def.nodeType);

  const nodeProps = props.def.propsForRendering;

  const center = Box.center(props.def.bounds);

  const isSelected = $d.selectionState.elements.includes(props.def);
  const isSingleSelected = isSelected && $d.selectionState.elements.length === 1;
  const isEdgeConnect = nodeProps.highlight.includes('edge-connect');

  const style: CSSProperties = {
    fill: nodeProps.fill.color,
    strokeWidth: nodeProps.stroke.width,
    stroke: isEdgeConnect ? 'red' : nodeProps.stroke.color
  };

  let patternId = undefined;

  if (nodeProps.fill.type === 'gradient') {
    style.fill = `url(#node-${props.def.id}-gradient)`;
  } else if (nodeProps.fill.type === 'image' || nodeProps.fill.type === 'texture') {
    patternId = `node-${props.def.id}-pattern`;
    style.fill = `url(#${patternId})`;
  } else if (nodeProps.fill.type === 'pattern' && nodeProps.fill.pattern !== '') {
    patternId = `node-${props.def.id}-pattern`;
    style.fill = `url(#${patternId})`;
  }

  if (nodeProps.stroke.pattern) {
    style.strokeDasharray = DASH_PATTERNS[nodeProps.stroke.pattern]?.(
      nodeProps.stroke.patternSize / 100,
      nodeProps.stroke.patternSpacing / 100
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

  const ReactNodeImpl = (nodeDef as ReactNodeDefinition).reactNode;

  let filterId = undefined;
  if (nodeProps.effects.blur || nodeProps.effects.opacity !== 1) {
    filterId = `node-${props.def.id}-filter`;
    style.filter = `url(#${filterId})`;
  }

  // TODO: We should only apply the rotation to leaf nodes and not to groups or containers
  //       ... changing this likely means changing Node.tsx and Container.tsx
  //       ... or maybe it's better to continue like this with reverse rotations in Node and Container
  return (
    <>
      {filterId && <NodeFilter id={filterId} nodeProps={nodeProps} />}

      {patternId && <NodePattern patternId={patternId} nodeProps={nodeProps} def={props.def} />}

      <g
        id={`node-${props.def.id}`}
        className={'svg-node ' + nodeProps.highlight.map(h => `svg-node--highlight-${h}`).join(' ')}
        transform={`rotate(${Angle.toDeg(props.def.bounds.r)} ${center.x} ${center.y})`}
      >
        {nodeProps.fill.type === 'gradient' && nodeProps.fill.gradient.type === 'linear' && (
          <linearGradient
            id={`node-${props.def.id}-gradient`}
            gradientTransform={`rotate(${Angle.toDeg(nodeProps.fill.gradient.direction)} 0.5 0.5)`}
          >
            <stop stopColor={nodeProps.fill.color} offset="0%" />
            <stop stopColor={nodeProps.fill.color2} offset="100%" />
          </linearGradient>
        )}
        {nodeProps.fill.type === 'gradient' && nodeProps.fill.gradient.type === 'radial' && (
          <radialGradient
            id={`node-${props.def.id}-gradient`}
            gradientTransform={`rotate(${Angle.toDeg(nodeProps.fill.gradient.direction)} 0.5 0.5)`}
          >
            <stop stopColor={nodeProps.fill.color} offset="0%" />
            <stop stopColor={nodeProps.fill.color2} offset="100%" />
          </radialGradient>
        )}
        <ReactNodeImpl
          def={nodeDef}
          diagram={$d}
          node={props.def}
          nodeProps={nodeProps}
          onMouseDown={onMouseDown}
          isSelected={isSelected}
          isSingleSelected={isSingleSelected}
          style={style}
          tool={props.tool}
          childProps={{
            onMouseDown: props.onMouseDown,
            onDoubleClick: props.onDoubleClick,
            applicationTriggers: props.applicationTriggers
          }}
        />

        {isEdgeConnect && (
          <g transform={`rotate(${-Angle.toDeg(props.def.bounds.r)} ${center.x} ${center.y})`}>
            {props.def.anchors.map(anchor => (
              <circle
                key={`${anchor.point.x}_${anchor.point.y}`}
                className={'svg-node__anchor'}
                cx={props.def.bounds.x + anchor.point.x * props.def.bounds.w}
                cy={props.def.bounds.y + anchor.point.y * props.def.bounds.h}
                r={5}
              />
            ))}
          </g>
        )}
      </g>
    </>
  );
});

type Props = {
  def: DiagramNode;
  diagram: Diagram;
  tool: Tool | undefined;
  onMouseDown: (id: string, coord: Point, modifiers: Modifiers) => void;
  onDoubleClick?: (id: string, coord: Point) => void;
  mode?: 'picker' | 'canvas';
  applicationTriggers: ApplicationTriggers;
} & Omit<
  SVGProps<SVGGElement>,
  'id' | 'transform' | 'onMouseMove' | 'onMouseDown' | 'onDoubleClick'
>;
