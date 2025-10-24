import { Component } from '../component/component';
import { Path } from '@diagram-craft/geometry/path';
import { DeepReadonly, DeepRequired } from '@diagram-craft/utils/types';
import { EventHelper } from '@diagram-craft/utils/eventHelper';
import { applyLineHops, clipPath } from '@diagram-craft/model/diagramEdgeUtils';
import * as svg from '../component/vdom-svg';
import { asDistortedSvgPath, parseArrowSvgPath } from '../effects/sketch';
import { hash } from '@diagram-craft/utils/hash';
import { VNode } from '../component/vdom';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { DRAG_DROP_MANAGER } from '../dragDropManager';
import { EdgeWaypointDrag } from '../drag/edgeWaypointDrag';
import { EdgeControlPointDrag } from '../drag/edgeControlPointDrag';
import { ARROW_SHAPES, ArrowShape } from '../arrowShapes';
import {
  type ControlPoints,
  DiagramEdge,
  EdgePropsForRendering
} from '@diagram-craft/model/diagramEdge';
import { VerifyNotReached } from '@diagram-craft/utils/assert';
import { ShapeEdgeDefinition } from '../shape/shapeEdgeDefinition';
import { ShapeBuilder } from '../shape/ShapeBuilder';
import { makeControlPoint } from '../shape/ShapeControlPoint';
import { Context, OnDoubleClick, OnMouseDown } from '../context';
import { getHighlights } from '../highlight';
import { EdgeEndpointMoveDrag } from '../drag/edgeEndpointMoveDrag';
import { Zoom } from './zoom';
import { renderElement } from './renderElement';
import { CanvasDomHelper } from '../utils/canvasDomHelper';
import type { EdgeCapability } from '@diagram-craft/model/edgeDefinition';

export type EdgeComponentProps = {
  element: DiagramEdge;
  onMouseDown?: OnMouseDown;
  onDoubleClick?: OnDoubleClick;
  isReadOnly?: boolean;
  context: Context;
};

const makeArrowMarker = (
  id: string,
  arrow: ArrowShape | undefined,
  edgeProps: DeepReadonly<DeepRequired<EdgeProps>>
) => {
  if (!arrow) return null;

  const { color, width } = edgeProps.stroke;
  const fillColor = edgeProps.fill.color;
  const sketch = edgeProps.effects.sketch;

  let path = arrow.path;
  if (sketch) {
    const seed = hash(new TextEncoder().encode(id));
    path = parseArrowSvgPath(arrow.path)
      .map(p => asDistortedSvgPath(p, seed, { passes: 2 }))
      .join(' ');
  }

  return svg.marker(
    {
      id: id,
      viewBox: `${-width} ${-width} ${arrow.width + 1 + width} ${arrow.height + 1 + width}`,
      refX: arrow.anchor.x,
      refY: arrow.anchor.y,
      markerUnits: 'userSpaceOnUse',
      markerWidth: arrow.width + 2,
      markerHeight: arrow.height + 2,
      orient: 'auto-start-reverse'
    },
    svg.path({
      'd': path,
      'stroke': color,
      'stroke-width': width,
      'stroke-linejoin': 'miter',
      'stroke-miterlimit': '40',
      'stroke-linecap': 'butt',
      'fill': arrow.fill === 'fg' ? fillColor : arrow.fill === 'bg' ? 'white' : 'none'
    })
  );
};

export abstract class BaseEdgeComponent extends Component<EdgeComponentProps> {
  buildShape(
    _path: Path,
    _shapeBuilder: ShapeBuilder,
    _edge: DiagramEdge,
    _props: EdgePropsForRendering
  ) {
    throw new VerifyNotReached();
  }

  render(props: EdgeComponentProps) {
    if (props.element.renderProps.hidden) return svg.g({});

    const $d = props.element.diagram;
    const actionMap = props.context.actions;

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      props.onMouseDown!(props.element.id, EventHelper.point(e), e);
      e.stopPropagation();
    };

    const isSelected = $d.selection.elements.includes(props.element);
    const isSingleSelected = isSelected && $d.selection.elements.length === 1;
    const firstEdge = $d.selection.edges[0]!;

    const edgeProps = props.element.renderProps;

    const startArrow = this.getArrow('start', edgeProps);
    const endArrow = this.getArrow('end', edgeProps);

    const basePath = clipPath(props.element.path(), props.element, startArrow, endArrow);
    if (basePath === undefined) return svg.g({});

    const z = new Zoom($d.viewBox.zoomLevel);

    const points: VNode[] = [];

    if (isSingleSelected && edgeProps.type !== 'curved') {
      for (const mp of firstEdge.path().midpoints) {
        points.push(
          svg.circle({
            class: 'svg-handle svg-midpoint-handle',
            cx: mp.x,
            cy: mp.y,
            r: z.num(3, 1.5),
            on: {
              mousedown: (e: MouseEvent) => {
                if (e.button !== 0) return;
                const uow = new UnitOfWork($d);
                const idx = props.element.addWaypoint(
                  { point: $d.viewBox.toDiagramPoint(EventHelper.point(e)) },
                  uow
                );
                uow.commit();

                DRAG_DROP_MANAGER.initiate(new EdgeWaypointDrag(props.element, idx, props.context));
                e.stopPropagation();
              }
            }
          })
        );
      }
    }

    if (isSingleSelected) {
      firstEdge.waypoints.map((wp, idx) => {
        if (edgeProps.type === 'bezier') {
          for (const [name, cp] of Object.entries(wp.controlPoints ?? {})) {
            points.push(
              svg.line({
                class: 'svg-bezier-handle-line',
                x1: wp.point.x + cp.x,
                y1: wp.point.y + cp.y,
                x2: wp.point.x,
                y2: wp.point.y
              })
            );
            points.push(
              svg.circle({
                class: 'svg-handle svg-bezier-handle',
                cx: wp.point.x + cp.x,
                cy: wp.point.y + cp.y,
                r: z.num(4, 2),
                on: {
                  mousedown: (e: MouseEvent) => {
                    if (e.button !== 0) return;
                    DRAG_DROP_MANAGER.initiate(
                      new EdgeControlPointDrag(
                        props.element,
                        idx,
                        name as keyof ControlPoints,
                        props.context
                      )
                    );
                    e.stopPropagation();
                  }
                }
              })
            );
          }
        }

        points.push(
          svg.circle({
            class: 'svg-handle svg-waypoint-handle',
            cx: wp.point.x,
            cy: wp.point.y,
            r: z.num(4, 2),
            on: {
              dblclick: e => {
                if (e.button !== 0) return;
                if (!e.metaKey) return;
                actionMap['WAYPOINT_DELETE']?.execute({
                  id: props.element.id,
                  point: wp.point
                });
                e.stopPropagation();
              },
              mousedown: e => {
                if (e.button !== 0) return;
                DRAG_DROP_MANAGER.initiate(new EdgeWaypointDrag(props.element, idx, props.context));
                e.stopPropagation();
              }
            }
          })
        );
      });
    }

    const arrowMarkers = [
      makeArrowMarker(`s_${props.element.id}`, startArrow, edgeProps),
      makeArrowMarker(`e_${props.element.id}`, endArrow, edgeProps)
    ].filter(Boolean) as VNode[];

    const shapeBuilder = new ShapeBuilder({
      element: props.element,
      elementProps: edgeProps,
      style: {},
      isSingleSelected,
      onMouseDown: () => {}
    });

    this.buildShape(basePath, shapeBuilder, props.element, edgeProps);

    const controlPoints: VNode[] = [];
    if (isSingleSelected && props.context.tool.get() === 'move') {
      for (const cp of shapeBuilder.controlPoints) {
        controlPoints.push(makeControlPoint(cp, props.element));
      }
    }

    const isDraggingThisEdge =
      DRAG_DROP_MANAGER.isDragging() &&
      DRAG_DROP_MANAGER.current() instanceof EdgeEndpointMoveDrag &&
      (DRAG_DROP_MANAGER.current() as EdgeEndpointMoveDrag).edge.id === props.element.id;

    const children = props.element.children.map(child =>
      renderElement(this, child, {
        context: props.context,
        isReadOnly: false,
        childProps: {
          onMouseDown: props.onMouseDown!,
          onDoubleClick: undefined
        }
      })
    );

    return svg.g(
      {
        id: CanvasDomHelper.edgeId(props.element),
        class: `${props.isReadOnly ? 'svg-readonly' : ''} ${getHighlights(props.element)
          .map(h => `svg-edge--highlight-${h}`)
          .join(' ')}`,
        on: {
          ...(!props.isReadOnly && props.onMouseDown ? { mousedown: onMouseDown } : {}),
          ...(!props.isReadOnly && props.onDoubleClick
            ? { dblclick: e => props.onDoubleClick?.(props.element.id, EventHelper.point(e)) }
            : {})
        },
        style: `
          pointer-events: ${!props.onMouseDown || isDraggingThisEdge ? 'none' : 'unset'};
          ${!props.onMouseDown ? 'cursor: default;' : ''}
        `
      },
      ...arrowMarkers,
      ...shapeBuilder.nodes,
      ...points,
      ...controlPoints,
      ...children
    );
  }

  protected getArrow(type: 'start' | 'end', edgeProps: DeepReadonly<DeepRequired<EdgeProps>>) {
    const size = (1 + (edgeProps.stroke.width - 1) * 10 + edgeProps.arrow[type].size) / 100;
    return ARROW_SHAPES[edgeProps.arrow[type].type]?.(size, edgeProps.stroke.width);
  }
}

export class SimpleEdgeDefinition extends ShapeEdgeDefinition {
  constructor() {
    super('Simple', 'Simple', SimpleEdgeDefinition.Shape);
  }

  static Shape = class extends BaseEdgeComponent {
    buildShape(
      path: Path,
      shapeBuilder: ShapeBuilder,
      edge: DiagramEdge,
      props: DeepReadonly<DeepRequired<EdgeProps>>
    ) {
      const paths = applyLineHops(path, edge, undefined, undefined, edge.intersections);
      shapeBuilder.edge(
        paths,
        edge.renderProps,
        this.getArrow('start', props),
        this.getArrow('end', props),
        { style: { fill: 'none' } }
      );
    }
  };

  supports(capability: EdgeCapability): boolean {
    return !['fill'].includes(capability);
  }
}
