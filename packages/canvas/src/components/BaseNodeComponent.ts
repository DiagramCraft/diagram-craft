import { $cmp, Component } from '../component/component';
import { VNode } from '../component/vdom';
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
import { ShapeBuilder } from '../shape/ShapeBuilder';
import { makeControlPoint } from '../shape/ShapeControlPoint';
import { DiagramNode, NodePropsForRendering } from '@diagram-craft/model/diagramNode';
import { EventHelper } from '@diagram-craft/utils/eventHelper';
import { VERIFY_NOT_REACHED } from '@diagram-craft/utils/assert';
import { makeReflection } from '../effects/reflection';
import { makeBlur } from '../effects/blur';
import { makeOpacity } from '../effects/opacity';
import { DiagramElement, isEdge, isNode } from '@diagram-craft/model/diagramElement';
import { EdgeComponentProps } from './BaseEdgeComponent';
import { ShapeEdgeDefinition } from '../shape/shapeEdgeDefinition';
import { Context, OnDoubleClick, OnMouseDown } from '../context';
import { PathBuilder } from '@diagram-craft/geometry/pathBuilder';
import { NodeCapability } from '@diagram-craft/model/elementDefinitionRegistry';
import { getHighlights, hasHighlight } from '../highlight';

export type NodeComponentProps = {
  element: DiagramNode;
  onMouseDown: OnMouseDown;
  onDoubleClick?: OnDoubleClick;
  mode?: 'picker' | 'canvas';
} & Context;

/**
 * The properties that are passed to the buildShape method of a BaseNodeComponent.
 */
export type BaseShapeBuildShapeProps = {
  node: DiagramNode;
  nodeProps: NodePropsForRendering;

  style: Partial<CSSStyleDeclaration>;
  isSingleSelected: boolean;

  onMouseDown: (e: MouseEvent) => void;
  onDoubleClick?: (e: MouseEvent) => void;

  childProps: {
    onMouseDown: OnMouseDown;
    onDoubleClick?: OnDoubleClick;
  };
} & Context;

export class BaseNodeComponent<
  T extends {
    getBoundingPathBuilder(node: DiagramNode): PathBuilder;
    supports(capability: NodeCapability): boolean;
  } = ShapeNodeDefinition
> extends Component<NodeComponentProps> {
  constructor(protected readonly def: T) {
    super();
  }

  buildShape(props: BaseShapeBuildShapeProps, shapeBuilder: ShapeBuilder) {
    const boundary = this.def.getBoundingPathBuilder(props.node).getPaths();
    shapeBuilder.boundaryPath(boundary.all());
    shapeBuilder.text(this);
  }

  render(props: NodeComponentProps): VNode {
    const $d = props.element.diagram;

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;

      const target = document.getElementById(`diagram-${$d.id}`) as HTMLElement | undefined;
      if (!target) return;

      props.onMouseDown(props.element.id, EventHelper.pointWithRespectTo(e, target), e);
      e.stopPropagation();
    };

    const onDoubleClick = props.onDoubleClick
      ? (e: MouseEvent) => {
          if (e.button !== 0) return;

          const target = document.getElementById(`diagram-${$d.id}`) as HTMLElement | undefined;
          if (!target) return;

          props.onDoubleClick?.(props.element.id, EventHelper.pointWithRespectTo(e, target));
          e.stopPropagation();
        }
      : undefined;

    const nodeProps = props.element.renderProps;

    const isSelected = $d.selectionState.elements.includes(props.element);
    const isSingleSelected = isSelected && $d.selectionState.elements.length === 1;
    const isEdgeConnect = hasHighlight(props.element, 'edge-connect');
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
      const gradientId = `node-${props.element.id}-gradient`;
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
      const patternId = `node-${props.element.id}-pattern`;
      style.fill = `url(#${patternId})`;

      /* An image based fill has both color adjustments and the fill itself */
      children.push(this.subComponent($cmp(PatternFillColorAdjustment), { patternId, nodeProps }));
      children.push(
        this.subComponent($cmp(FillPattern), { patternId, nodeProps, def: props.element })
      );
    } else if (nodeProps.fill.type === 'pattern' && nodeProps.fill.pattern !== '') {
      const patternId = `node-${props.element.id}-pattern`;
      style.fill = `url(#${patternId})`;

      children.push(
        this.subComponent($cmp(FillPattern), { patternId, nodeProps, def: props.element })
      );
    }

    if (!this.def.supports('fill')) {
      style.fill = 'none';
    }

    /* Build shape ******************************************************************* */

    const buildProps: BaseShapeBuildShapeProps = {
      node: props.element,
      nodeProps,

      style,
      isSingleSelected,

      onMouseDown,
      onDoubleClick,

      childProps: {
        onMouseDown: props.onMouseDown,
        onDoubleClick: props.onDoubleClick
      },

      actionMap: props.actionMap,
      tool: props.tool,
      applicationTriggers: props.applicationTriggers
    };

    const shapeBuilder = new ShapeBuilder({
      ...buildProps,
      element: buildProps.node,
      elementProps: buildProps.nodeProps
    });
    this.buildShape(buildProps, shapeBuilder);

    if (!shapeBuilder.boundaryPathExists) {
      console.warn('Node has no boundary path', props.element.id, props.element.nodeType);
    }

    const shapeVNodes = [...shapeBuilder.nodes];

    if (isSingleSelected && props.tool?.type === 'move') {
      for (const cp of shapeBuilder.controlPoints) {
        shapeVNodes.push(makeControlPoint(cp, props.element));
      }
    }

    /* Handle all effects ************************************************************ */

    if (nodeProps.shadow.enabled) {
      style.filter = makeShadowFilter(nodeProps.shadow);
    }

    if (nodeProps.effects.blur || nodeProps.effects.opacity !== 1) {
      const filterId = `node-${props.element.id}-filter`;
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
      children.push(svg.g({}, ...makeReflection(props.element, shapeVNodes), ...shapeVNodes));
    } else {
      children.push(...shapeVNodes);
    }

    /* Add anchors ******************************************************************* */

    if (isEdgeConnect) {
      children.push(
        svg.g(
          {},
          ...props.element.anchors.map((anchor, idx) =>
            svg.circle({
              class: 'svg-node__anchor',
              cx: props.element.bounds.x + anchor.start.x * props.element.bounds.w,
              cy: props.element.bounds.y + anchor.start.y * props.element.bounds.h,
              r: '5',
              // TODO: Change this to be a class instead of a fixed color
              style: `pointer-events: none; fill: ${hasHighlight(props.element, `anchor-${idx}`) ? '#16a34a' : 'transparent'};`
            })
          )
        )
      );
    }

    const transform = `${Transforms.rotate(props.element.bounds)} ${nodeProps.geometry.flipH ? Transforms.flipH(props.element.bounds) : ''} ${nodeProps.geometry.flipV ? Transforms.flipV(props.element.bounds) : ''}`;
    return svg.g(
      {
        id: `node-${props.element.id}`,
        class:
          'svg-node ' +
          getHighlights(props.element)
            .map(h => `svg-node--highlight-${h}`)
            .join(' '),
        transform: transform.trim(),
        style: style.filter ? `filter: ${style.filter}` : ''
      },
      ...children
    );
  }

  protected makeElement(child: DiagramElement, props: BaseShapeBuildShapeProps) {
    const p: NodeComponentProps & EdgeComponentProps = {
      key: isNode(child) ? `node-${child.id}` : `edge-${child.id}`,
      // @ts-expect-error - this is fine as child is either node or edge
      element: child,
      onDoubleClick: props.childProps.onDoubleClick,
      onMouseDown: props.childProps.onMouseDown,

      tool: props.tool,
      applicationTriggers: props.applicationTriggers,
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

export type SimpleShapeNodeDefinitionProps = BaseShapeBuildShapeProps & {
  cmp: BaseNodeComponent<SimpleShapeNodeDefinition>;
};

export abstract class SimpleShapeNodeDefinition extends ShapeNodeDefinition {
  constructor(type: string, name?: string) {
    super(type, name ?? type, SimpleShapeNodeDefinition.Component);
  }

  abstract buildShape(props: SimpleShapeNodeDefinitionProps, shapeBuilder: ShapeBuilder): void;

  static Component = class extends BaseNodeComponent<SimpleShapeNodeDefinition> {
    buildShape(props: BaseShapeBuildShapeProps, shapeBuilder: ShapeBuilder) {
      return this.def.buildShape({ ...props, cmp: this }, shapeBuilder);
    }
  };
}
