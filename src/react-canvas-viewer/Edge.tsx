import React, {
  CSSProperties,
  forwardRef,
  Fragment,
  MouseEventHandler,
  useCallback,
  useImperativeHandle
} from 'react';
import { useRedraw } from './useRedraw.tsx';
import { Point } from '../geometry/point.ts';
import { useDragDrop } from './DragDropManager.ts';
import { ApplicationTriggers } from '../react-canvas-editor/EditableCanvas.tsx';
import { ARROW_SHAPES } from '../base-ui/arrowShapes.ts';
import { DASH_PATTERNS } from '../base-ui/dashPatterns.ts';
import { EventHelper } from '../base-ui/eventHelper.ts';
import { DiagramEdge } from '../model/diagramEdge.ts';
import { Diagram } from '../model/diagram.ts';
import { makeShadowFilter } from '../base-ui/styleUtils.ts';
import { applyLineHops, clipPath } from '../model/edgeUtils.ts';
import { Modifiers } from '../base-ui/drag/dragDropManager.ts';
import { BezierControlPointDrag } from '../base-ui/drag/bezierControlPointDrag.ts';
import { EdgeWaypointDrag } from '../base-ui/drag/edgeWaypointDrag.ts';
import { ArrowMarker } from './ArrowMarker.tsx';
import { UnitOfWork } from '../model/unitOfWork.ts';
import { useActions } from '../react-app/context/ActionsContext.tsx';
import { Tool } from '../react-canvas-editor/tools/types.ts';
import { ControlPoints } from '../model/types.ts';
import { asDistortedSvgPath } from './sketch.ts';
import { hash } from '../utils/hash.ts';

export type EdgeApi = {
  repaint: () => void;
};

export const Edge = forwardRef<EdgeApi, Props>((props, ref) => {
  const $d = props.diagram;
  const redraw = useRedraw();
  const drag = useDragDrop();
  const { actionMap } = useActions();

  useImperativeHandle(ref, () => ({ repaint: redraw }));

  const onMouseDown = useCallback<MouseEventHandler>(
    e => {
      if (e.button !== 0) return;
      props.onMouseDown(props.def.id, EventHelper.point(e.nativeEvent), e.nativeEvent);
      e.stopPropagation();
    },
    [props]
  );

  const onContextMenu = (event: React.MouseEvent<SVGPathElement, MouseEvent>) => {
    props.applicationTriggers.showEdgeContextMenu?.(
      $d.viewBox.toDiagramPoint(EventHelper.point(event.nativeEvent)),
      props.def.id,
      event.nativeEvent
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

  if (basePath === undefined) return null;

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

  return (
    <g id={`edge-${props.def.id}`}>
      <ArrowMarker
        id={`s_${props.def.id}`}
        arrow={startArrow}
        width={width}
        color={color}
        fillColor={fillColor}
        sketch={edgeProps.effects.sketch}
      />
      <ArrowMarker
        id={`e_${props.def.id}`}
        arrow={endArrow}
        width={width}
        color={color}
        fillColor={fillColor}
        sketch={edgeProps.effects.sketch}
      />

      <path
        className={'svg-edge'}
        d={path}
        onMouseDown={onMouseDown}
        onDoubleClick={e => props.onDoubleClick(props.def.id, EventHelper.point(e.nativeEvent))}
        onContextMenu={onContextMenu}
        stroke={'transparent'}
        strokeWidth={15}
      />
      <path
        className={'svg-edge'}
        d={path}
        onMouseDown={onMouseDown}
        onDoubleClick={e => props.onDoubleClick(props.def.id, EventHelper.point(e.nativeEvent))}
        onContextMenu={onContextMenu}
        style={style}
        markerStart={startArrow ? `url(#s_${props.def.id})` : undefined}
        markerEnd={endArrow ? `url(#e_${props.def.id})` : undefined}
      />

      {isSingleSelected &&
        edgeProps.type !== 'curved' &&
        firstEdge.midpoints.map(mp => (
          <circle
            key={`${mp.x}_${mp.y}`}
            className="svg-midpoint-handle"
            cx={mp.x}
            cy={mp.y}
            r="3"
            onMouseDown={e => {
              if (e.button !== 0) return;
              const uow = new UnitOfWork($d);
              const idx = props.def.addWaypoint(
                { point: $d.viewBox.toDiagramPoint(EventHelper.point(e.nativeEvent)) },
                uow
              );
              uow.commit();

              drag.initiate(new EdgeWaypointDrag(props.def, idx));
              e.stopPropagation();
            }}
            onContextMenu={onContextMenu}
          />
        ))}

      {isSingleSelected &&
        firstEdge.waypoints.map((wp, idx) => (
          <Fragment key={`${wp.point.x}_${wp.point.y}`}>
            {edgeProps.type === 'bezier' &&
              Object.entries(wp.controlPoints ?? {}).map(([name, cp]) => (
                <Fragment key={`${idx}_${cp.x}_${cp.y}`}>
                  <line
                    className="svg-bezier-handle-line"
                    x1={wp.point.x + cp.x}
                    y1={wp.point.y + cp.y}
                    x2={wp.point.x}
                    y2={wp.point.y}
                  />
                  <circle
                    className="svg-bezier-handle"
                    cx={wp.point.x + cp.x}
                    cy={wp.point.y + cp.y}
                    r="4"
                    onMouseDown={e => {
                      if (e.button !== 0) return;
                      drag.initiate(
                        new BezierControlPointDrag(props.def, idx, name as keyof ControlPoints)
                      );
                      e.stopPropagation();
                    }}
                  />
                </Fragment>
              ))}
            <circle
              className="svg-waypoint-handle"
              cx={wp.point.x}
              cy={wp.point.y}
              r="4"
              onDoubleClick={e => {
                if (e.button !== 0) return;
                if (!e.metaKey) return;
                actionMap['WAYPOINT_DELETE']?.execute({
                  id: props.def.id,
                  point: wp.point
                });
                e.stopPropagation();
              }}
              onMouseDown={e => {
                if (e.button !== 0) return;
                drag.initiate(new EdgeWaypointDrag(props.def, idx));
                e.stopPropagation();
              }}
              onContextMenu={onContextMenu}
            />
          </Fragment>
        ))}
    </g>
  );
});

type Props = {
  def: DiagramEdge;
  diagram: Diagram;
  tool: Tool | undefined;
  applicationTriggers: ApplicationTriggers;
  onMouseDown: (id: string, coord: Point, modifiers: Modifiers) => void;
  onDoubleClick: (id: string, coord: Point) => void;
};
