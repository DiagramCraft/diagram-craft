import { $cmp, Component } from '../component/component';
import { VNode } from '../component/vdom';
import { Tool } from '../tool';
import { ApplicationTriggers } from '../EditableCanvasComponent';
import { DASH_PATTERNS } from '../dashPatterns';
import { makeShadowFilter } from '../effects/shadow';
import {
  FillPattern,
  makeLinearGradient,
  makeRadialGradient,
  PatternFillColorAdjustment
} from '../shape/shapeFill';
import * as svg from '../component/vdom-svg';
import { Transforms } from '../component/vdom-svg';
import { ShapeNodeDefinition } from '../shape/shapeNodeDefinition';
import { Modifiers } from '../dragDropManager';
import { ShapeBuilder } from '../shape/ShapeBuilder';
import { makeControlPoint } from '../shape/ShapeControlPoint';
import { Point } from '@diagram-craft/geometry/point';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { Diagram } from '@diagram-craft/model/diagram';
import { DeepReadonly } from '@diagram-craft/utils/types';
import { EventHelper } from '@diagram-craft/utils/eventHelper';
import { VERIFY_NOT_REACHED } from '@diagram-craft/utils/assert';
import { makeReflection } from '../effects/reflection';
import { makeBlur } from '../effects/blur';
import { makeOpacity } from '../effects/opacity';
import { DiagramElement, isEdge, isNode } from '@diagram-craft/model/diagramElement';
import { Box } from '@diagram-craft/geometry/box';
import { EdgeComponentProps } from './BaseEdgeComponent';
import { ShapeEdgeDefinition } from '../shape/shapeEdgeDefinition';

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
  applicationTriggers: ApplicationTriggers;

  tool: Tool | undefined;
  actionMap: Partial<ActionMap>;
  childProps: {
    onMouseDown: (id: string, coord: Point, modifiers: Modifiers) => void;
    onDoubleClick?: (id: string, coord: Point) => void;
    applicationTriggers: ApplicationTriggers;
  };
};

/**
 * Transforms a point from the unit coordinate system to the given bounding box.
 * The unit coordinate system is a 2D coordinate system where x and y range from -1 to 1.
 * The transformation is done by scaling and translating the point to fit into the bounding box.
 *
 * @param {Point} point - The point in the unit coordinate system to be transformed
 * @param {Box} b - The bounding box where the point should be placed.
 *                  It is an object with x, y, w (width), and h (height) properties.
 * @returns {Object} The transformed point in the bounding box coordinate system
 */
export const pointInBounds = ({ x, y }: Point, b: Box) => {
  return {
    x: b.x + ((x + 1) * b.w) / 2,
    y: b.y + b.h - ((y + 1) * b.h) / 2
  };
};

export class BaseNodeComponent<
  T extends ShapeNodeDefinition = ShapeNodeDefinition
> extends Component<BaseShapeProps> {
  constructor(protected readonly def: T) {
    super();
  }

  buildShape(props: BaseShapeBuildProps, shapeBuilder: ShapeBuilder) {
    const boundary = this.def.getBoundingPathBuilder(props.node).getPaths();
    shapeBuilder.boundaryPath(boundary.all());
    shapeBuilder.text(this);
  }

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

    const isSelected = $d.selectionState.elements.includes(props.def);
    const isSingleSelected = isSelected && $d.selectionState.elements.length === 1;
    const isEdgeConnect = nodeProps.highlight.includes('edge-connect');
    const children: VNode[] = [];

    const style: Partial<CSSStyleDeclaration> = {};

    /* Handle strokes **************************************************************** */

    style.strokeWidth = nodeProps.stroke.width?.toString();
    style.stroke = isEdgeConnect ? 'red' : nodeProps.stroke.color;
    style.strokeLinecap = nodeProps.stroke.lineCap;
    style.strokeLinejoin = nodeProps.stroke.lineJoin;
    style.strokeMiterlimit = nodeProps.stroke.miterLimit.toString();

    if (nodeProps.stroke.pattern) {
      style.strokeDasharray = DASH_PATTERNS[nodeProps.stroke.pattern]?.(
        nodeProps.stroke.patternSize / 100,
        nodeProps.stroke.patternSpacing / 100
      );
    }

    if (nodeProps.stroke.enabled === false) {
      style.stroke = 'transparent';
      style.strokeWidth = '0';
    }

    /* Handle fills ****************************************************************** */

    if (nodeProps.fill.enabled === false) {
      style.fill = 'transparent';
    } else {
      style.fill = nodeProps.fill.color;
    }

    if (nodeProps.fill.type === 'gradient') {
      const gradientId = `node-${props.def.id}-gradient`;
      style.fill = `url(#${gradientId})`;

      /* For a gradient we need to add its definition */
      if (nodeProps.fill.gradient.type === 'linear') {
        children.push(makeLinearGradient(gradientId, nodeProps));
      } else if (nodeProps.fill.gradient.type === 'radial') {
        children.push(makeRadialGradient(gradientId, nodeProps));
      } else {
        VERIFY_NOT_REACHED();
      }
    } else if (nodeProps.fill.type === 'image' || nodeProps.fill.type === 'texture') {
      const patternId = `node-${props.def.id}-pattern`;
      style.fill = `url(#${patternId})`;

      /* An image based fill has both color adjustments and the fill itself */
      children.push(this.subComponent($cmp(PatternFillColorAdjustment), { patternId, nodeProps }));
      children.push(this.subComponent($cmp(FillPattern), { patternId, nodeProps, def: props.def }));
    } else if (nodeProps.fill.type === 'pattern' && nodeProps.fill.pattern !== '') {
      const patternId = `node-${props.def.id}-pattern`;
      style.fill = `url(#${patternId})`;

      children.push(this.subComponent($cmp(FillPattern), { patternId, nodeProps, def: props.def }));
    }

    if (!this.def.supports('fill')) {
      style.fill = 'none';
    }

    /* Build shape ******************************************************************* */

    const buildProps: BaseShapeBuildProps = {
      node: props.def,
      actionMap: props.actionMap,
      tool: props.tool,
      applicationTriggers: props.applicationTriggers,
      onMouseDown,
      style,
      nodeProps,
      isSingleSelected,
      childProps: {
        onMouseDown: props.onMouseDown,
        onDoubleClick: props.onDoubleClick,
        applicationTriggers: props.applicationTriggers
      }
    };

    const shapeBuilder = new ShapeBuilder({
      ...buildProps,
      element: props.def,
      elementProps: nodeProps
    });
    this.buildShape(buildProps, shapeBuilder);

    const shapeVNodes = [...shapeBuilder.nodes];

    if (isSingleSelected && props.tool?.type === 'move') {
      for (const cp of shapeBuilder.controlPoints) {
        shapeVNodes.push(makeControlPoint(cp, props.def));
      }
    }

    /* Handle all effects ************************************************************ */

    if (nodeProps.shadow.enabled) {
      style.filter = makeShadowFilter(nodeProps.shadow);
    }

    if (nodeProps.effects.blur || nodeProps.effects.opacity !== 1) {
      const filterId = `node-${props.def.id}-filter`;
      style.filter = (style.filter ?? '') + ` url(#${filterId})`;

      children.push(
        svg.filter(
          { id: filterId, filterUnits: 'objectBoundingBox' },
          nodeProps.effects.blur ? makeBlur(nodeProps.effects.blur) : null,
          nodeProps.effects.opacity !== 1 ? makeOpacity(nodeProps.effects.opacity) : null
        )
      );
    }

    if (nodeProps.effects.reflection) {
      children.push(svg.g({}, ...makeReflection(props.def, shapeVNodes), ...shapeVNodes));
    } else {
      children.push(...shapeVNodes);
    }

    /* Add anchors ******************************************************************* */

    if (isEdgeConnect) {
      children.push(
        svg.g(
          { transform: Transforms.rotateBack(props.def.bounds) },
          ...props.def.anchors.map(anchor =>
            svg.circle({
              class: 'svg-node__anchor',
              cx: props.def.bounds.x + anchor.point.x * props.def.bounds.w,
              cy: props.def.bounds.y + anchor.point.y * props.def.bounds.h,
              r: '5',
              style: `pointer-events: none;`
            })
          )
        )
      );
    }

    return svg.g(
      {
        id: `node-${props.def.id}`,
        class: 'svg-node ' + nodeProps.highlight.map(h => `svg-node--highlight-${h}`).join(' '),
        transform: `${Transforms.rotate(props.def.bounds)} ${nodeProps.geometry.flipH ? Transforms.flipH(props.def.bounds) : ''} ${nodeProps.geometry.flipV ? Transforms.flipV(props.def.bounds) : ''}`,
        style: `filter: ${style.filter ?? 'none'}`
      },
      ...children
    );
  }

  protected makeElement(child: DiagramElement, props: BaseShapeBuildProps) {
    const p: BaseShapeProps & EdgeComponentProps = {
      key: isNode(child) ? `node-${child.id}` : `edge-${child.id}`,
      // @ts-expect-error - this is fine as child is either node or edge
      def: child,
      diagram: child.diagram,
      tool: props.tool,
      onDoubleClick: props.childProps.onDoubleClick ?? (() => {}),
      onMouseDown: props.childProps.onMouseDown,
      applicationTriggers: props.childProps.applicationTriggers,
      actionMap: props.actionMap
    };

    if (isNode(child)) {
      const nodeDefinition = child.getDefinition() as ShapeNodeDefinition;
      const nodeComponent = nodeDefinition.component!;
      return this.subComponent(() => new nodeComponent(nodeDefinition), p);
    } else if (isEdge(child)) {
      const edgeDefinition = child.getDefinition() as ShapeEdgeDefinition;
      const edgeComponent = edgeDefinition.component!;
      return this.subComponent(() => new edgeComponent(edgeDefinition), p);
    } else {
      VERIFY_NOT_REACHED();
    }
  }
}
