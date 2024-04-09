import { Component } from '../component/component.ts';
import { Diagram, DiagramEdge, DiagramNode, NodeDefinition } from '@diagram-craft/model';
import { VNode } from '../component/vdom.ts';
import { Angle } from '@diagram-craft/geometry/src/angle.ts';
import { deepClone, DeepReadonly } from '@diagram-craft/utils';
import { Tool } from '../tools/types.ts';
import { ApplicationTriggers } from '../EditableCanvas.ts';
import { DASH_PATTERNS } from '../dashPatterns.ts';
import { makeShadowFilter } from '../styleUtils.ts';
import { EventHelper } from '@diagram-craft/utils';
import { FillFilter, FillPattern } from './shapeFill.ts';
import * as svg from '../component/vdom-svg.ts';
import { EdgeComponent } from '../EdgeComponent.ts';
import { ShapeNodeDefinition } from './shapeNodeDefinition.ts';
import { Box, Path, Point } from '@diagram-craft/geometry';
import { Modifiers } from '../drag/dragDropManager.ts';
import { ShapeBuilder } from './ShapeBuilder.ts';
import { makeControlPoint } from './ShapeControlPoint.ts';

type NodeWrapperComponentProps = {
  children: VNode[];
  node: DiagramNode;
  path: Path;
  style: Partial<CSSStyleDeclaration>;
};

const wrapComponent = (props: NodeWrapperComponentProps) => {
  const center = Box.center(props.node.bounds);

  let pathBounds: Box | undefined = undefined;
  if (props.node.props.effects?.reflection) {
    const path = props.node.diagram.nodeDefinitions
      .get(props.node.nodeType)
      .getBoundingPath(props.node);

    pathBounds = path.bounds();
  }

  const strength = props.node.props.effects?.reflectionStrength?.toString() ?? '1';
  const reflection = props.node.props.effects?.reflection
    ? [
        svg.linearGradient(
          {
            id: `reflection-grad-${props.node.id}`,
            y2: '1',
            x2: '0',
            gradientUnits: 'objectBoundingBox',
            gradientTransform: `rotate(${-Angle.toDeg(props.node.bounds.r)} 0.5 0.5)`
          },
          svg.stop({ 'offset': '0.65', 'stop-color': 'white', 'stop-opacity': '0' }),
          svg.stop({ 'offset': '1', 'stop-color': 'white', 'stop-opacity': strength })
        ),
        svg.mask(
          {
            id: `reflection-mask-${props.node.id}`,
            maskContentUnits: 'objectBoundingBox'
          },
          svg.rect({
            width: '1',
            height: '1',
            fill: `url(#reflection-grad-${props.node.id})`
          })
        ),
        svg.g(
          {
            transform: `
              rotate(${-Angle.toDeg(props.node.bounds.r)} ${center.x} ${center.y})
              scale(1 -1)
              translate(0 -${2 * (pathBounds!.y + pathBounds!.h)})
              rotate(${Angle.toDeg(props.node.bounds.r)} ${center.x} ${center.y})
            `,
            mask: `url(#reflection-mask-${props.node.id})`,
            style: `filter: url(#reflection-filter); pointer-events: none`
          },
          ...props.children.map(e => deepClone(e))
        )
      ]
    : [];

  return svg.g(
    {
      style: `filter: ${props.style.filter ?? 'none'}`
    },
    ...reflection,
    ...props.children
  );
};

export type BaseShapeProps = {
  def: DiagramNode;
  diagram: Diagram;
  tool: Tool | undefined;
  onMouseDown: (id: string, coord: Point, modifiers: Modifiers) => void;
  onDoubleClick?: (id: string, coord: Point) => void;
  mode?: 'picker' | 'canvas';
  applicationTriggers: ApplicationTriggers;

  actionMap: Partial<ActionMap>;
};

export type BaseShapeBuildProps = {
  style: Partial<CSSStyleDeclaration>;
  nodeProps: DeepReadonly<NodeProps>;
  isSingleSelected: boolean;

  node: DiagramNode;
  onMouseDown: (e: MouseEvent) => void;

  tool: Tool | undefined;
  actionMap: Partial<ActionMap>;
  childProps: {
    onMouseDown: (id: string, coord: Point, modifiers: Modifiers) => void;
    onDoubleClick?: (id: string, coord: Point) => void;
    applicationTriggers: ApplicationTriggers;
  };
};

export abstract class BaseShape extends Component<BaseShapeProps> {
  constructor(protected readonly nodeDefinition: NodeDefinition) {
    super();
  }

  abstract buildShape(props: BaseShapeBuildProps, shapeBuilder: ShapeBuilder): void;

  render(props: BaseShapeProps): VNode {
    const $d = props.def.diagram;

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;

      const target = document.getElementById(`diagram-${$d.id}`) as HTMLElement | undefined;
      if (!target) return;

      props.onMouseDown(props.def.id, EventHelper.pointWithRespectTo(e, target), e);
      e.stopPropagation();
    };

    const nodeProps = props.def.propsForRendering;

    const center = Box.center(props.def.bounds);

    const isSelected = $d.selectionState.elements.includes(props.def);
    const isSingleSelected = isSelected && $d.selectionState.elements.length === 1;
    const isEdgeConnect = nodeProps.highlight.includes('edge-connect');

    const style: Partial<CSSStyleDeclaration> = {
      fill: nodeProps.fill.color,
      strokeWidth: nodeProps.stroke.width?.toString(),
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
      style.strokeWidth = '0';
    }

    if (nodeProps.fill.enabled === false) {
      style.fill = 'transparent';
    }

    let filterId = undefined;
    if (nodeProps.effects.blur || nodeProps.effects.opacity !== 1) {
      filterId = `node-${props.def.id}-filter`;
      style.filter = `url(#${filterId})`;
    }

    const buildProps: BaseShapeBuildProps = {
      node: props.def,
      actionMap: props.actionMap,
      tool: props.tool,
      onMouseDown: onMouseDown,
      style,
      nodeProps,
      isSingleSelected,
      childProps: {
        onMouseDown: props.onMouseDown,
        onDoubleClick: props.onDoubleClick,
        applicationTriggers: props.applicationTriggers
      }
    };

    const shapeBuilder = new ShapeBuilder(buildProps);
    this.buildShape(buildProps, shapeBuilder);

    const children = [...shapeBuilder.children];

    if (isSingleSelected && props.tool?.type === 'move') {
      for (const cp of shapeBuilder.controlPoints) {
        children.push(makeControlPoint(cp, props.def));
      }
    }

    const outer: VNode[] = [];
    const level1: VNode[] = [];

    if (filterId) {
      outer.push(
        svg.filter(
          {
            id: filterId,
            filterUnits: 'objectBoundingBox'
          },
          nodeProps.effects.blur
            ? svg.feGaussianBlur({ stdDeviation: 5 * nodeProps.effects.blur })
            : null,
          nodeProps.effects.opacity !== 1
            ? svg.feColorMatrix({
                type: 'matrix',
                values: `1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${nodeProps.effects.opacity} 0`
              })
            : null
        )
      );
    }

    if (patternId) {
      outer.push(this.subComponent('fillFilter', () => new FillFilter(), { patternId, nodeProps }));
      outer.push(
        this.subComponent('fillPattern', () => new FillPattern(), {
          patternId,
          nodeProps,
          def: props.def
        })
      );
    }

    if (nodeProps.fill.type === 'gradient' && nodeProps.fill.gradient.type === 'linear') {
      level1.push(
        svg.linearGradient(
          {
            id: `node-${props.def.id}-gradient`,
            gradientTransform: `rotate(${Angle.toDeg(nodeProps.fill.gradient.direction)} 0.5 0.5)`
          },
          svg.stop({
            'offset': '0%',
            'stop-color': nodeProps.fill.color
          }),
          svg.stop({
            'offset': '100%',
            'stop-color': nodeProps.fill.color2
          })
        )
      );
    }

    if (nodeProps.fill.type === 'gradient' && nodeProps.fill.gradient.type === 'radial') {
      level1.push(
        svg.radialGradient(
          {
            id: `node-${props.def.id}-gradient`,
            gradientTransform: `rotate(${Angle.toDeg(nodeProps.fill.gradient.direction)} 0.5 0.5)`
          },
          svg.stop({ 'offset': '0%', 'stop-color': nodeProps.fill.color }),
          svg.stop({ 'offset': '100%', 'stop-color': nodeProps.fill.color2 })
        )
      );
    }

    level1.push(
      wrapComponent({
        node: props.def,
        path: shapeBuilder.boundary!,
        style: style,
        children
      })
    );

    if (isEdgeConnect) {
      level1.push(
        svg.g(
          { transform: `rotate(${-Angle.toDeg(props.def.bounds.r)} ${center.x} ${center.y})` },
          ...props.def.anchors.map(anchor =>
            svg.circle({
              class: 'svg-node__anchor',
              cx: props.def.bounds.x + anchor.point.x * props.def.bounds.w,
              cy: props.def.bounds.y + anchor.point.y * props.def.bounds.h,
              r: '5'
            })
          )
        )
      );
    }

    return svg.g(
      {},
      ...outer,
      svg.g(
        {
          id: `node-${props.def.id}`,
          class: 'svg-node ' + nodeProps.highlight.map(h => `svg-node--highlight-${h}`).join(' '),
          transform: `rotate(${Angle.toDeg(props.def.bounds.r)} ${center.x} ${center.y})`
        },
        ...level1
      )
    );
  }

  protected makeEdge(child: DiagramEdge, props: BaseShapeBuildProps) {
    return this.subComponent(`edge-${child.id}`, () => new EdgeComponent(), {
      def: child,
      diagram: child.diagram,
      tool: props.tool,
      onDoubleClick: props.childProps.onDoubleClick ?? (() => {}),
      onMouseDown: props.childProps.onMouseDown,
      applicationTriggers: props.childProps.applicationTriggers,
      actionMap: props.actionMap
    });
  }

  protected makeNode(child: DiagramNode, props: BaseShapeBuildProps) {
    const nodeProps: BaseShapeProps = {
      def: child as DiagramNode,
      applicationTriggers: props.childProps.applicationTriggers,
      diagram: child.diagram,
      tool: props.tool,
      onMouseDown: props.childProps.onMouseDown,
      onDoubleClick: props.childProps.onDoubleClick ?? (() => {}),
      actionMap: props.actionMap
    };

    return this.subComponent(
      `node-${child.id}`,
      (props.node.diagram.nodeDefinitions.get(child.nodeType) as ShapeNodeDefinition).component!,
      nodeProps
    );
  }

  protected rotateBack(center: Point, angle: number, child: VNode) {
    return svg.g({ transform: `rotate(${-angle} ${center.x} ${center.y})` }, child);
  }
}
