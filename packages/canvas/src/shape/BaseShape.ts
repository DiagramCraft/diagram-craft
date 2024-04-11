import { Component } from '../component/component';
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
} from './shapeFill';
import * as svg from '../component/vdom-svg';
import { Transforms } from '../component/vdom-svg';
import { EdgeComponent } from '../components/EdgeComponent';
import { ShapeNodeDefinition } from './shapeNodeDefinition';
import { Modifiers } from '../dragDropManager';
import { ShapeBuilder } from './ShapeBuilder';
import { makeControlPoint } from './ShapeControlPoint';
import { Point } from '@diagram-craft/geometry/point';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { Diagram } from '@diagram-craft/model/diagram';
import { NodeDefinition } from '@diagram-craft/model/elementDefinitionRegistry';
import { DiagramEdge } from '@diagram-craft/model/diagramEdge';
import { DeepReadonly } from '@diagram-craft/utils/types';
import { EventHelper } from '@diagram-craft/utils/eventHelper';
import { VERIFY_NOT_REACHED } from '@diagram-craft/utils/assert';
import { makeReflection } from '../effects/reflection';
import { makeBlur } from '../effects/blur';
import { makeOpacity } from '../effects/opacity';

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

    const isSelected = $d.selectionState.elements.includes(props.def);
    const isSingleSelected = isSelected && $d.selectionState.elements.length === 1;
    const isEdgeConnect = nodeProps.highlight.includes('edge-connect');
    const children: VNode[] = [];

    const style: Partial<CSSStyleDeclaration> = {};

    /* Handle strokes **************************************************************** */

    style.strokeWidth = nodeProps.stroke.width?.toString();
    style.stroke = isEdgeConnect ? 'red' : nodeProps.stroke.color;

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

      children.push(
        this.subComponent('PatternFillColorAdjustment', () => new PatternFillColorAdjustment(), {
          patternId,
          nodeProps
        })
      );
      children.push(
        this.subComponent('FillPattern', () => new FillPattern(), {
          patternId,
          nodeProps,
          def: props.def
        })
      );
    } else if (nodeProps.fill.type === 'pattern' && nodeProps.fill.pattern !== '') {
      const patternId = `node-${props.def.id}-pattern`;
      style.fill = `url(#${patternId})`;

      children.push(
        this.subComponent('FillPattern', () => new FillPattern(), {
          patternId,
          nodeProps,
          def: props.def
        })
      );
    }

    /* Build shape ******************************************************************* */

    const buildProps: BaseShapeBuildProps = {
      node: props.def,
      actionMap: props.actionMap,
      tool: props.tool,
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

    const shapeBuilder = new ShapeBuilder(buildProps);
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
              r: '5'
            })
          )
        )
      );
    }

    return svg.g(
      {
        id: `node-${props.def.id}`,
        class: 'svg-node ' + nodeProps.highlight.map(h => `svg-node--highlight-${h}`).join(' '),
        transform: Transforms.rotate(props.def.bounds),
        style: `filter: ${style.filter ?? 'none'}`
      },
      ...children
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
}
