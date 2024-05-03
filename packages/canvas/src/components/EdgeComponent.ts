import { Component } from '../component/component';
import { toInlineCSS, VNode } from '../component/vdom';
import { Tool } from '../tool';
import { ApplicationTriggers } from '../EditableCanvasComponent';
import { ARROW_SHAPES, ArrowShape } from '../arrowShapes';
import { DASH_PATTERNS } from '../dashPatterns';
import { makeShadowFilter } from '../effects/shadow';
import { DRAG_DROP_MANAGER, Modifiers } from '../dragDropManager';
import * as svg from '../component/vdom-svg';
import { EdgeWaypointDrag } from '../drag/edgeWaypointDrag';
import { EdgeControlPointDrag } from '../drag/edgeControlPointDrag';
import { asDistortedSvgPath, parseArrowSvgPath } from '../effects/sketch';
import { Point } from '@diagram-craft/geometry/point';
import { applyLineHops, clipPath } from '@diagram-craft/model/edgeUtils';
import { DiagramEdge } from '@diagram-craft/model/diagramEdge';
import { Diagram } from '@diagram-craft/model/diagram';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { ControlPoints } from '@diagram-craft/model/types';
import { hash } from '@diagram-craft/utils/hash';
import { EventHelper } from '@diagram-craft/utils/eventHelper';
import { Path } from '@diagram-craft/geometry/path';
import { DeepReadonly, DeepRequired } from '@diagram-craft/utils/types';
import { LengthOffsetOnPath } from '@diagram-craft/geometry/pathPosition';
import { Vector } from '@diagram-craft/geometry/vector';
import { RawSegment } from '@diagram-craft/geometry/pathBuilder';

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

declare global {
  interface EdgeProps {
    shapeBlockArrow?: {
      arrowDepth?: number;
      arrowWidth?: number;
      width?: number;
    };
  }
}

const blockArrowMakePath = (path: Path, props: EdgeComponentProps) => {
  const width = props.def.propsForRendering.shapeBlockArrow?.width ?? 20;
  const arrowDepth = props.def.propsForRendering.shapeBlockArrow?.arrowDepth ?? 20;
  const arrowWidth = props.def.propsForRendering.shapeBlockArrow?.arrowWidth ?? 50;

  const offset1 = path.offset(width / 2);
  const offset2 = path.offset(-width / 2);

  // Join the start of both paths
  const start = new Path(offset2.start, [['L', offset1.start.x, offset1.start.y]]);

  // Add arrow shape
  const len1 = offset1.length();
  const [shortened1] = offset1.split(
    LengthOffsetOnPath.toTimeOffsetOnSegment({ pathD: len1 - arrowDepth }, offset1)
  );

  const len2 = offset2.length();
  const [shortened2] = offset2.split(
    LengthOffsetOnPath.toTimeOffsetOnSegment({ pathD: len2 - arrowDepth }, offset2)
  );

  const normal = Vector.tangentToNormal(offset1.tangentAt({ pathD: len1 - arrowDepth }));

  const arrowWidthOffset = (arrowWidth - width) / 2;
  const arrowShapeSegments: RawSegment[] = [
    [
      'L',
      Point.add(shortened1.end, Vector.scale(normal, arrowWidthOffset)).x,
      Point.add(shortened1.end, Vector.scale(normal, arrowWidthOffset)).y
    ],
    ['L', path.end.x, path.end.y],
    [
      'L',
      Point.add(shortened2.end, Vector.scale(normal, -arrowWidthOffset)).x,
      Point.add(shortened2.end, Vector.scale(normal, -arrowWidthOffset)).y
    ],
    ['L', shortened2.end.x, shortened2.end.y]
  ];

  return [
    Path.join(start, shortened1, new Path(shortened1.end, arrowShapeSegments), shortened2.reverse())
  ];
};

const simpleMakePath = (
  path: Path,
  props: EdgeComponentProps,
  startArrow: ArrowShape | undefined,
  endArrow: ArrowShape | undefined
) => {
  return applyLineHops(path, props.def, startArrow, endArrow, props.def.intersections);
};

export class EdgeComponent extends Component<EdgeComponentProps> {
  getPaths(path: Path, props: EdgeComponentProps) {
    if (props.def.propsForRendering.shape === 'BlockArrow') {
      return blockArrowMakePath(path, props);
    } else {
      const startArrow = this.getArrow('start', props.def.propsForRendering);
      const endArrow = this.getArrow('end', props.def.propsForRendering);

      return simpleMakePath(path, props, startArrow, endArrow);
    }
  }

  processStyle(
    style: Partial<CSSStyleDeclaration>,
    edgeProps: DeepReadonly<DeepRequired<EdgeProps>>
  ): DeepReadonly<DeepRequired<EdgeProps>> {
    if (edgeProps.shape === 'BlockArrow') {
      style.fill = edgeProps.fill.color ?? 'none';
      style.opacity = (edgeProps.effects.opacity ?? 1).toString();
      return {
        ...edgeProps,
        arrow: {
          start: { type: 'NONE', size: 0 },
          end: { type: 'NONE', size: 0 }
        }
      };
    }
    return edgeProps;
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

    let edgeProps = props.def.propsForRendering;

    const color = edgeProps.stroke.color;
    const fillColor = edgeProps.fill.color;
    const width = edgeProps.stroke.width;

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

    edgeProps = this.processStyle(style, edgeProps);

    const startArrow = this.getArrow('start', edgeProps);
    const endArrow = this.getArrow('end', edgeProps);

    const basePath = clipPath(props.def.path(), props.def, startArrow, endArrow);

    if (basePath === undefined) return svg.g({});

    const paths = this.getPaths(basePath, props);

    // TODO: Cleanup
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

  private getArrow(type: 'start' | 'end', edgeProps: DeepReadonly<DeepRequired<EdgeProps>>) {
    const size = (1 + (edgeProps.stroke.width - 1) * 10 + edgeProps.arrow[type].size) / 100;
    return ARROW_SHAPES[edgeProps.arrow[type].type]?.(size);
  }
}
