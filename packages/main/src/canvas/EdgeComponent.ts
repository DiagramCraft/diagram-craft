import { Component } from '../base-ui/component.ts';
import { toInlineCSS, VNode } from '../base-ui/vdom.ts';
import { DiagramEdge } from '../model/diagramEdge.ts';
import { Diagram } from '../model/diagram.ts';
import { Tool } from './tools/types.ts';
import { ApplicationTriggers } from './EditableCanvas.ts';
import { Modifiers } from '../base-ui/drag/dragDropManager.ts';
import { ARROW_SHAPES, ArrowShape } from '../base-ui/arrowShapes.ts';
import { applyLineHops, clipPath } from '../model/edgeUtils.ts';
import { asDistortedSvgPath, parseArrowSvgPath } from './sketch.ts';
import { hash } from '@diagram-craft/utils';
import { EventHelper } from '../base-ui/eventHelper.ts';
import { CSSProperties } from 'react';
import { DASH_PATTERNS } from '../base-ui/dashPatterns.ts';
import { makeShadowFilter } from '../base-ui/styleUtils.ts';
import { UnitOfWork } from '../model/unitOfWork.ts';
import { EdgeWaypointDrag } from '../base-ui/drag/edgeWaypointDrag.ts';
import { DRAG_DROP_MANAGER } from './DragDropManager.ts';
import { BezierControlPointDrag } from '../base-ui/drag/bezierControlPointDrag.ts';
import { ControlPoints } from '../model/types.ts';
import * as svg from '../base-ui/vdom-svg.ts';
import { Point } from '@diagram-craft/geometry';

const makeArrowMarker = ({
  id,
  arrow,
  width,
  color,
  fillColor,
  sketch
}: {
  id: string;
  arrow: ArrowShape | undefined;
  width: number;
  color: string;
  fillColor: string;
  sketch?: boolean;
}) => {
  if (!arrow) return null;

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

export class EdgeComponent extends Component<EdgeComponentProps> {
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

    const color = edgeProps.stroke.color;
    const fillColor = edgeProps.fill.color;
    const width = edgeProps.stroke.width;

    const style: CSSProperties = {
      strokeDasharray:
        DASH_PATTERNS[edgeProps.stroke.pattern]?.(
          edgeProps.stroke.patternSize / 100,
          edgeProps.stroke.patternSpacing / 100
        ) ?? '',
      strokeWidth: width,
      stroke: color
    };
    if (edgeProps.shadow.enabled) {
      style.filter = makeShadowFilter(edgeProps.shadow);
    }

    if (edgeProps.highlight.includes('drop-target')) {
      style.stroke = '#30A46C';
      style.strokeWidth = 3;
      style.strokeDasharray = '';
    }

    const startArrowSize = edgeProps.arrow.start.size / 100;
    const startArrow = ARROW_SHAPES[edgeProps.arrow.start.type]?.(startArrowSize);

    const endArrowSize = edgeProps.arrow.end.size / 100;
    const endArrow = ARROW_SHAPES[edgeProps.arrow.end.type]?.(endArrowSize);

    const basePath = clipPath(props.def.path(), props.def, startArrow, endArrow);

    if (basePath === undefined) return svg.g({});

    // TODO: Cleanup
    const paths = applyLineHops(basePath, props.def, startArrow, endArrow, props.def.intersections);
    const path = paths
      .map(p =>
        edgeProps.effects.sketch
          ? asDistortedSvgPath(p, hash(new TextEncoder().encode(props.def.id)), {
              passes: 2,
              amount: edgeProps.effects.sketchStrength ?? 0.1,
              unidirectional: true
            })
          : p.asSvgPath()
      )
      .join(', ');

    const arrowMarkers: VNode[] = [
      makeArrowMarker({
        id: `s_${props.def.id}`,
        arrow: startArrow,
        width: width,
        color: color,
        fillColor: fillColor,
        sketch: edgeProps.effects.sketch
      }),
      makeArrowMarker({
        id: `e_${props.def.id}`,
        arrow: endArrow,
        width: width,
        color: color,
        fillColor: fillColor,
        sketch: edgeProps.effects.sketch
      })
    ].filter(Boolean) as VNode[];

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

                DRAG_DROP_MANAGER.initiate(new EdgeWaypointDrag(props.def, idx));
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
                      new BezierControlPointDrag(props.def, idx, name as keyof ControlPoints)
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
                DRAG_DROP_MANAGER.initiate(new EdgeWaypointDrag(props.def, idx));
                e.stopPropagation();
              },
              contextmenu: onContextMenu
            }
          })
        );
      });
    }

    return svg.g(
      {
        id: `edge-${props.def.id}`
      },
      ...arrowMarkers,
      svg.path({
        'class': 'svg-edge',
        'd': path,
        'stroke': 'transparent',
        'stroke-width': 15,
        'on': {
          mousedown: onMouseDown,
          dblclick: e => props.onDoubleClick(props.def.id, EventHelper.point(e)),
          contextmenu: onContextMenu
        }
      }),
      svg.path({
        'class': 'svg-edge',
        'd': path,
        // @ts-ignore
        'style': toInlineCSS(style),
        'marker-start': startArrow ? `url(#s_${props.def.id})` : '',
        'marker-end': endArrow ? `url(#e_${props.def.id})` : '',
        'on': {
          mousedown: onMouseDown,
          dblclick: e => props.onDoubleClick(props.def.id, EventHelper.point(e)),
          contextmenu: onContextMenu
        }
      }),
      ...points
    );
  }
}
