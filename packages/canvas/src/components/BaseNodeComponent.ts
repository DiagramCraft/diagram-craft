import { Component } from '../component/component';
import { VNode } from '../component/vdom';
import { DASH_PATTERNS } from '../dashPatterns';
import { addFillComponents, makeLinearGradient } from '../shape/shapeFill';
import * as svg from '../component/vdom-svg';
import { Transforms } from '../component/vdom-svg';
import { ShapeNodeDefinition } from '../shape/shapeNodeDefinition';
import { ShapeBuilder } from '../shape/ShapeBuilder';
import { makeControlPoint } from '../shape/ShapeControlPoint';
import { DiagramNode, NodePropsForRendering } from '@diagram-craft/model/diagramNode';
import { EventHelper } from '@diagram-craft/utils/eventHelper';
import { Context, OnDoubleClick, OnMouseDown } from '../context';
import { getHighlights } from '../highlight';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { Indicator } from '@diagram-craft/model/diagramProps';
import { DeepRequired } from '@diagram-craft/utils/types';
import { INDICATORS } from './indicators';
import { Box, WritableBox } from '@diagram-craft/geometry/box';
import { isEmptyString } from '@diagram-craft/utils/strings';
import { makeIsometricTransform } from '../effects/isometric';
import { CanvasDomHelper } from '../utils/canvasDomHelper';
import { EffectsRegistry } from '@diagram-craft/model/effect';

export type NodeComponentProps = {
  element: DiagramNode;
  onMouseDown: OnMouseDown;
  onDoubleClick?: OnDoubleClick;
  mode?: 'picker' | 'canvas';
  isReadOnly?: boolean;

  context: Context;
};

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
  isReadOnly: boolean;

  childProps: {
    onMouseDown: OnMouseDown;
    onDoubleClick?: OnDoubleClick;
  };

  context: Context;
};

export class BaseNodeComponent<
  T extends Pick<ShapeNodeDefinition, 'getBoundingPathBuilder' | 'supports'> = ShapeNodeDefinition
> extends Component<NodeComponentProps> {
  constructor(protected readonly def: T) {
    super();
  }

  protected onTextSizeChange(props: BaseShapeBuildShapeProps) {
    return (size: { w: number; h: number }) => {
      const { w: width, h: height } = size;
      const { bounds } = props.node;

      // Note: we want label nodes to always be as small as possible
      if (width > bounds.w || height > bounds.h || props.node.isLabelNode()) {
        const newBounds = {
          x: bounds.x,
          y: bounds.y,
          r: bounds.r,
          h: props.node.isLabelNode() ? height : Math.max(height, bounds.h),
          w: props.node.isLabelNode() ? width : Math.max(width, bounds.w)
        };

        if (props.node.renderProps.text.align === 'center' && width > bounds.w) {
          newBounds.x = bounds.x - (width - bounds.w) / 2;
        }

        UnitOfWork.execute(props.node.diagram, uow => props.node.setBounds(newBounds, uow), true);
      }
    };
  }

  buildShape(props: BaseShapeBuildShapeProps, shapeBuilder: ShapeBuilder) {
    const boundary = this.def.getBoundingPathBuilder(props.node).getPaths();
    shapeBuilder.boundaryPath(boundary.all());

    if (props.nodeProps.capabilities.textGrow) {
      shapeBuilder.text(
        this,
        '1',
        props.node.getText(),
        props.nodeProps.text,
        props.node.bounds,
        this.onTextSizeChange(props)
      );
    } else {
      shapeBuilder.text(this);
    }
  }

  render(props: NodeComponentProps): VNode {
    if (props.element.renderProps.hidden) return svg.g({});

    const $d = props.element.diagram;

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;

      const target = CanvasDomHelper.diagramElement($d);
      if (!target) return;

      props.onMouseDown(props.element.id, EventHelper.pointWithRespectTo(e, target), e);
      e.stopPropagation();
    };

    const onDoubleClick = props.onDoubleClick
      ? (e: MouseEvent) => {
          if (e.button !== 0) return;

          const target = CanvasDomHelper.diagramElement($d);
          if (!target) return;

          props.onDoubleClick?.(props.element.id, EventHelper.pointWithRespectTo(e, target));
          e.stopPropagation();
        }
      : undefined;

    const nodeProps = props.element.renderProps;

    const isSelected = $d.selection.elements.includes(props.element);
    const isSingleSelected = isSelected && $d.selection.elements.length === 1;
    const children: VNode[] = [];

    const style: Partial<CSSStyleDeclaration> = {};

    /* Handle strokes **************************************************************** */

    style.strokeWidth = nodeProps.stroke.width.toString();
    style.stroke = nodeProps.stroke.color;
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

    addFillComponents(
      'node',
      props.element.id,
      nodeProps.fill.type,
      nodeProps.fill,
      props.element.diagram,
      props.element.bounds,
      style,
      children,
      this
    );

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
      isReadOnly: props.isReadOnly ?? false,

      childProps: {
        onMouseDown: props.onMouseDown,
        onDoubleClick: props.onDoubleClick
      },

      context: props.context
    };

    const shapeBuilder = new ShapeBuilder({
      ...buildProps,
      element: buildProps.node,
      elementProps: buildProps.nodeProps
    });
    this.buildShape(buildProps, shapeBuilder);

    if (!shapeBuilder.boundaryPathExists && props.element.nodeType !== 'group') {
      console.warn('Node has no boundary path', props.element.id, props.element.nodeType);
    }

    const shapeVNodes = [...shapeBuilder.nodes];

    if (isSingleSelected && props.context.tool.get() === 'move') {
      for (const cp of shapeBuilder.controlPoints) {
        shapeVNodes.push(makeControlPoint(cp, props.element));
      }
    }

    /* Handle all effects ************************************************************ */

    const isIsometric = nodeProps.effects.isometric.enabled;
    const isometricTransform = isIsometric
      ? makeIsometricTransform(props.element.bounds, props.element.renderProps)
      : undefined;

    const cssFilter = EffectsRegistry.get(nodeProps, undefined, 'getCSSFilter')
      .map(e => e.getCSSFilter(nodeProps))
      .join(' ');
    if (!isEmptyString(cssFilter)) {
      style.filter = cssFilter;
    }

    const svgFilters = EffectsRegistry.get(nodeProps, undefined, 'getSVGFilter').flatMap(e =>
      e.getSVGFilter(nodeProps)
    );
    if (svgFilters.length > 0) {
      const filterId = `node-${props.element.id}-filter`;
      style.filter = `${style.filter ?? ''} url(#${filterId})`;

      children.push(svg.filter({ id: filterId, filterUnits: 'objectBoundingBox' }, ...svgFilters));
    }

    const extraNodes = EffectsRegistry.get(nodeProps, undefined, 'getExtraSVGElements').flatMap(e =>
      e.getExtraSVGElements(props.element, shapeVNodes)
    );
    if (extraNodes.length > 0) {
      children.push(...extraNodes);
    }

    children.push(...shapeVNodes);

    /* Handle indicators */
    for (const indicator of Object.values(nodeProps.indicators)) {
      if (!indicator.enabled) continue;

      children.push(this.buildIndicator(props, indicator));
    }

    if (props.element.renderProps.debug.boundingPath === true) {
      this.addBoundingPathDebug(props, children);
    }
    if (props.element.renderProps.debug.anchors === true) {
      this.addAnchorsDebug(props, children);
    }

    if (props.element.renderProps.effects.glass) {
      const { x, y, w, h } = props.element.bounds;
      children.push(
        makeLinearGradient(`${props.element.id}-glass-gradient`, {
          color: 'rgba(255, 255, 255, 0.1)',
          color2: 'rgba(255, 255, 255, 0.8)',
          gradient: {
            direction: -Math.PI / 2
          }
        })
      );

      // TODO: This is quite ugly... can we expose the boundary nodes from ShapeBuilder somehow
      children.push(
        svg.clipPath(
          {
            id: `${props.element.id}-glass-clip`
          },
          svg.path({
            d: shapeBuilder.nodes.find(
              n =>
                n.tag === 'path' &&
                (n.data.class as string | undefined)?.includes('svg-node__boundary')
            )?.data.d as string
          })
        )
      );
      children.push(
        svg.path({
          'd': `
            M ${x} ${y} 
            L ${x} ${y + h * 0.3} 
            A ${w / 2} ${h * 0.2} 0 0 0 ${x + w / 2} ${y + h * 0.5} 
            A ${w / 2} ${h * 0.2} 0 0 0 ${x + w} ${y + h * 0.3} 
            L ${x + w} ${y}
            Z`,
          'clip-path': `url(#${props.element.id}-glass-clip)`,
          'fill': `url(#${props.element.id}-glass-gradient)`,
          'style': `pointer-events: none;`
        })
      );
    }

    const transform = `${Transforms.rotate(props.element.bounds)} ${nodeProps.geometry.flipH ? Transforms.flipH(props.element.bounds) : ''} ${nodeProps.geometry.flipV ? Transforms.flipV(props.element.bounds) : ''} ${isIsometric ? isometricTransform?.svgForward() : ''}`;
    const hasAction =
      props.element.renderProps.action.type !== undefined &&
      props.element.renderProps.action.type !== 'none' &&
      !isEmptyString(props.element.renderProps.action.url);

    const mainGroup = svg.g(
      {
        id: CanvasDomHelper.nodeId(props.element),
        class:
          'svg-node ' +
          (props.isReadOnly ? 'svg-readonly' : '') +
          ' ' +
          (hasAction ? 'svg-node--with-action' : '') +
          ' ' +
          getHighlights(props.element)
            .map(h => `svg-node--highlight-${h}`)
            .join(' '),
        transform: transform.trim(),
        style: !isIsometric && style.filter ? `filter: ${style.filter}` : ''
      },
      ...children
    );

    if (isIsometric) {
      return svg.g({ style: style.filter ? `filter: ${style.filter}` : '' }, mainGroup);
    } else {
      return mainGroup;
    }
  }

  private buildIndicator(props: NodeComponentProps, indicator: DeepRequired<Indicator>) {
    const eBounds = props.element.bounds;

    const bounds: WritableBox = Box.asReadWrite({
      x: eBounds.x + indicator.offset,
      y: eBounds.y + eBounds.h / 2 - indicator.height / 2,
      w: indicator.width,
      h: indicator.height,
      r: eBounds.r
    });

    if (indicator.position === 'w') {
      // Do nothing
    } else if (indicator.position === 'nw') {
      bounds.y = eBounds.y + indicator.offset;
    } else if (indicator.position === 'n') {
      bounds.y = eBounds.y + indicator.offset;
      bounds.x = eBounds.x + eBounds.w / 2 - indicator.width / 2;
    } else if (indicator.position === 'ne') {
      bounds.y = eBounds.y + indicator.offset;
      bounds.x = eBounds.x + eBounds.w - indicator.width - indicator.offset;
    } else if (indicator.position === 'e') {
      bounds.x = eBounds.x + eBounds.w - indicator.width - indicator.offset;
    } else if (indicator.position === 'se') {
      bounds.x = eBounds.x + eBounds.w - indicator.width - indicator.offset;
      bounds.y = eBounds.y + eBounds.h - indicator.height - indicator.offset;
    } else if (indicator.position === 's') {
      bounds.y = eBounds.y + eBounds.h - indicator.height - indicator.offset;
      bounds.x = eBounds.x + eBounds.w / 2 - indicator.width / 2;
    } else if (indicator.position === 'sw') {
      bounds.y = eBounds.y + eBounds.h - indicator.height - indicator.offset;
    } else if (indicator.position === 'c') {
      bounds.x = eBounds.x + eBounds.w / 2 - indicator.width / 2;
      bounds.y = eBounds.y + eBounds.h / 2 - indicator.height / 2;
    }

    const DIRECTIONS = {
      e: 0,
      w: 180,
      n: 270,
      s: 90
    };
    const r = DIRECTIONS[indicator.direction];

    const renderer = INDICATORS[indicator.shape as keyof typeof INDICATORS] ?? INDICATORS['none'];

    return svg.g(
      {
        transform: `
          rotate(${r} ${bounds.x + bounds.w / 2}, ${bounds.y + bounds.h / 2})
          translate(${bounds.x}, ${bounds.y})
        `
      },
      svg.rect({
        'x': 0,
        'y': 0,
        'width': indicator.width,
        'height': indicator.height,
        'stroke-width': 0,
        'fill': 'transparent'
      }),
      renderer(WritableBox.asBox(bounds), indicator, props.element.renderProps.fill.color)
    );
  }

  private addAnchorsDebug(props: NodeComponentProps, children: VNode[]) {
    for (const anchor of props.element.anchors) {
      if (anchor.type === 'edge') {
        children.push(
          svg.line({
            x1: props.element.bounds.x + anchor.start.x * props.element.bounds.w,
            y1: props.element.bounds.y + anchor.start.y * props.element.bounds.h,
            x2: props.element.bounds.x + anchor.end!.x * props.element.bounds.w,
            y2: props.element.bounds.y + anchor.end!.y * props.element.bounds.h,
            style: 'stroke: rgba(200, 200, 255, 0.5); stroke-width: 8; pointer-events: none;'
          })
        );
      } else {
        children.push(
          svg.circle({
            'cx': props.element.bounds.x + anchor.start.x * props.element.bounds.w,
            'cy': props.element.bounds.y + anchor.start.y * props.element.bounds.h,
            'r': 4,
            'style': 'stroke: blue; fill: rgba(200, 200, 255, 0.5);',
            'data-id': anchor.id
          })
        );
      }
    }
  }

  private addBoundingPathDebug(props: NodeComponentProps, children: VNode[]) {
    const builder = this.def.getBoundingPathBuilder(props.element);

    const boundary = builder.getPaths();

    const color = boundary.all().some(p => p.isClockwise()) ? 'red' : 'green';

    children.push(
      svg.marker(
        {
          id: 'boundary-path-arrow',
          viewBox: '0 0 10 6',
          refX: '10',
          refY: '3',
          markerWidth: '6',
          markerHeight: '6',
          orient: 'auto-start-reverse'
        },
        svg.path({
          d: 'M 0 0 L 10 3 L 0 6 z'
        })
      )
    );
    children.push(
      svg.path({
        'd': boundary.asSvgPath(),
        'style': `stroke: ${color}; stroke-width: 3; fill: none;`,
        'marker-end': 'url(#boundary-path-arrow)'
      })
    );
  }
}

export type SimpleShapeNodeDefinitionProps = BaseShapeBuildShapeProps & {
  cmp: BaseNodeComponent<SimpleShapeNodeDefinition>;
};

export abstract class SimpleShapeNodeDefinition extends ShapeNodeDefinition {
  protected constructor(type: string, name?: string) {
    super(type, name ?? type, SimpleShapeNodeDefinition.Component);
  }

  abstract buildShape(props: SimpleShapeNodeDefinitionProps, shapeBuilder: ShapeBuilder): void;

  static Component = class extends BaseNodeComponent<SimpleShapeNodeDefinition> {
    buildShape(props: BaseShapeBuildShapeProps, shapeBuilder: ShapeBuilder) {
      return this.def.buildShape({ ...props, cmp: this }, shapeBuilder);
    }
  };
}
