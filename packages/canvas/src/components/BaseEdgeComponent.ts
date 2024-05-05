import { Component } from '../component/component';
import { Path } from '@diagram-craft/geometry/path';
import { DeepReadonly, DeepRequired } from '@diagram-craft/utils/types';
import { EventHelper } from '@diagram-craft/utils/eventHelper';
import { DASH_PATTERNS } from '../dashPatterns';
import { makeShadowFilter } from '../effects/shadow';
import { applyLineHops, clipPath } from '@diagram-craft/model/edgeUtils';
import * as svg from '../component/vdom-svg';
import { asDistortedSvgPath, parseArrowSvgPath } from '../effects/sketch';
import { hash } from '@diagram-craft/utils/hash';
import { VNode } from '../component/vdom';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { DRAG_DROP_MANAGER, Modifiers } from '../dragDropManager';
import { EdgeWaypointDrag } from '../drag/edgeWaypointDrag';
import { EdgeControlPointDrag } from '../drag/edgeControlPointDrag';
import { ControlPoints } from '@diagram-craft/model/types';
import { ARROW_SHAPES, ArrowShape } from '../arrowShapes';
import { DiagramEdge } from '@diagram-craft/model/diagramEdge';
import { Diagram } from '@diagram-craft/model/diagram';
import { Tool } from '../tool';
import { ApplicationTriggers } from '../EditableCanvasComponent';
import { Point } from '@diagram-craft/geometry/point';
import { VerifyNotReached } from '@diagram-craft/utils/assert';
import { ShapeEdgeDefinition } from '../shape/shapeEdgeDefinition';
import { EdgeCapability } from '@diagram-craft/model/elementDefinitionRegistry';
import { ShapeBuilder } from '../shape/ShapeBuilder';

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
      .join(', ');
  }

  return svg.marker(
    {
      id: id,
      viewBox: `${-width} ${-width} ${arrow.width + 1 + width} ${arrow.height + 1 + width}`,
      refX: arrow.anchor.x,
      refY: arrow.anchor.y,
      markerUnits: 'userSpaceOnUse',
      strokeLinejoin: 'round',
      strokeLinecap: 'round',
      markerWidth: arrow.width + 2,
      markerHeight: arrow.height + 2,
      orient: 'auto-start-reverse'
    },
    svg.path({
      'd': path,
      'stroke': color,
      'stroke-width': width,
      'fill': arrow.fill === 'fg' ? fillColor : arrow.fill === 'bg' ? 'white' : 'none'
    })
  );
};

export type EdgeComponentProps = {
  def: DiagramEdge;
  diagram: Diagram;
  tool: Tool | undefined;
  applicationTriggers: ApplicationTriggers;
  onMouseDown: (id: string, coord: Point, modifiers: Modifiers) => void;
  onDoubleClick: (id: string, coord: Point) => void;
  actionMap: Partial<ActionMap>;
};

declare global {
  interface EdgeProps {
    shapeBlockArrow?: {
      arrowDepth?: number;
      arrowWidth?: number;
      width?: number;
    };
  }
}

export abstract class BaseEdgeComponent extends Component<EdgeComponentProps> {
  buildShape(
    _path: Path,
    _shapeBuilder: ShapeBuilder,
    _edge: DiagramEdge,
    _props: DeepReadonly<DeepRequired<EdgeProps>>
  ) {
    throw new VerifyNotReached();
  }

  getStyle(edgeProps: DeepReadonly<DeepRequired<EdgeProps>>): Partial<CSSStyleDeclaration> {
    const width = edgeProps.stroke.width;
    const color = edgeProps.stroke.color;

    const style: Partial<CSSStyleDeclaration> = {
      strokeDasharray:
        DASH_PATTERNS[edgeProps.stroke.pattern]?.(
          edgeProps.stroke.patternSize / 100,
          edgeProps.stroke.patternSpacing / 100
        ) ?? '',
      strokeWidth: width.toString(),
      stroke: color,
      strokeLinecap: edgeProps.stroke.lineCap,
      strokeLinejoin: edgeProps.stroke.lineJoin,
      strokeMiterlimit: edgeProps.stroke.miterLimit.toString()
    };

    if (edgeProps.shadow.enabled) {
      style.filter = makeShadowFilter(edgeProps.shadow);
    }

    if (edgeProps.highlight.includes('drop-target')) {
      style.stroke = '#30A46C';
      style.strokeWidth = '3';
      style.strokeDasharray = '';
    }

    return style;
  }

  render(props: EdgeComponentProps) {
    const $d = props.diagram;
    const actionMap = props.actionMap;

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      props.onMouseDown(props.def.id, EventHelper.point(e), e);
      e.stopPropagation();
    };

    const onContextMenu = (event: MouseEvent) => {
      props.applicationTriggers.showEdgeContextMenu?.(
        $d.viewBox.toDiagramPoint(EventHelper.point(event)),
        props.def.id,
        event
      );
    };

    const isSelected = $d.selectionState.elements.includes(props.def);
    const isSingleSelected = isSelected && $d.selectionState.elements.length === 1;
    const firstEdge = $d.selectionState.edges[0];

    const edgeProps = props.def.propsForRendering;

    const startArrow = this.getArrow('start', edgeProps);
    const endArrow = this.getArrow('end', edgeProps);

    const basePath = clipPath(props.def.path(), props.def, startArrow, endArrow);
    if (basePath === undefined) return svg.g({});

    const points: VNode[] = [];

    if (isSingleSelected && edgeProps.type !== 'curved') {
      for (const mp of firstEdge.midpoints) {
        points.push(
          svg.circle({
            class: 'svg-midpoint-handle',
            cx: mp.x,
            cy: mp.y,
            r: 3,
            on: {
              mousedown: (e: MouseEvent) => {
                if (e.button !== 0) return;
                const uow = new UnitOfWork($d);
                const idx = props.def.addWaypoint(
                  { point: $d.viewBox.toDiagramPoint(EventHelper.point(e)) },
                  uow
                );
                uow.commit();

                DRAG_DROP_MANAGER.initiate(
                  new EdgeWaypointDrag(props.def, idx, props.applicationTriggers)
                );
                e.stopPropagation();
              },
              contextmenu: onContextMenu
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
                class: 'svg-bezier-handle',
                cx: wp.point.x + cp.x,
                cy: wp.point.y + cp.y,
                r: 4,
                on: {
                  mousedown: (e: MouseEvent) => {
                    if (e.button !== 0) return;
                    DRAG_DROP_MANAGER.initiate(
                      new EdgeControlPointDrag(
                        props.def,
                        idx,
                        name as keyof ControlPoints,
                        props.applicationTriggers
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
            class: 'svg-waypoint-handle',
            cx: wp.point.x,
            cy: wp.point.y,
            r: 4,
            on: {
              dblclick: e => {
                if (e.button !== 0) return;
                if (!e.metaKey) return;
                actionMap['WAYPOINT_DELETE']?.execute({
                  id: props.def.id,
                  point: wp.point
                });
                e.stopPropagation();
              },
              mousedown: e => {
                if (e.button !== 0) return;
                DRAG_DROP_MANAGER.initiate(
                  new EdgeWaypointDrag(props.def, idx, props.applicationTriggers)
                );
                e.stopPropagation();
              },
              contextmenu: onContextMenu
            }
          })
        );
      });
    }

    const arrowMarkers = [
      makeArrowMarker(`s_${props.def.id}`, startArrow, edgeProps),
      makeArrowMarker(`e_${props.def.id}`, endArrow, edgeProps)
    ].filter(Boolean) as VNode[];

    const shapeBuilder = new ShapeBuilder({
      element: props.def,
      elementProps: edgeProps,
      style: this.getStyle(edgeProps),
      isSingleSelected,
      onMouseDown: () => {},
      tool: props.tool
    });

    this.buildShape(basePath, shapeBuilder, props.def, edgeProps);

    return svg.g(
      {
        id: `edge-${props.def.id}`,
        on: {
          mousedown: onMouseDown,
          dblclick: e => props.onDoubleClick(props.def.id, EventHelper.point(e)),
          contextmenu: onContextMenu
        }
      },
      ...arrowMarkers,
      ...shapeBuilder.nodes,
      ...points
    );
  }

  protected getArrow(type: 'start' | 'end', edgeProps: DeepReadonly<DeepRequired<EdgeProps>>) {
    const size = (1 + (edgeProps.stroke.width - 1) * 10 + edgeProps.arrow[type].size) / 100;
    return ARROW_SHAPES[edgeProps.arrow[type].type]?.(size);
  }
}

export class SimpleEdgeDefinition extends ShapeEdgeDefinition {
  constructor() {
    super('Simple', 'Simple', SimpleEdgeComponent);
  }

  supports(capability: EdgeCapability): boolean {
    return !['fill'].includes(capability);
  }
}

export class SimpleEdgeComponent extends BaseEdgeComponent {
  buildShape(
    path: Path,
    shapeBuilder: ShapeBuilder,
    edge: DiagramEdge,
    props: DeepReadonly<DeepRequired<EdgeProps>>
  ) {
    const paths = applyLineHops(path, edge, undefined, undefined, edge.intersections);
    shapeBuilder.edge(
      paths,
      this.getStyle(props),
      edge.propsForRendering,
      this.getArrow('start', props),
      this.getArrow('end', props)
    );
  }
}
