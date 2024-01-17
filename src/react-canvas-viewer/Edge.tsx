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
import { deepMerge } from '../utils/deepmerge.ts';
import { useConfiguration } from '../react-app/context/ConfigurationContext.tsx';
import { Diagram } from '../model/diagram.ts';
import { makeShadowFilter } from '../base-ui/styleUtils.ts';
import { applyLineHops, clipPath } from '../model/edgeUtils.ts';
import { Modifiers } from '../base-ui/drag/dragDropManager.ts';
import { BezierControlPointDrag } from '../base-ui/drag/bezierControlPointDrag.ts';
import { EdgeWaypointDrag } from '../base-ui/drag/edgeWaypointDrag.ts';
import { ArrowMarker } from './ArrowMarker.tsx';
import { DeepRequired } from '../utils/types.ts';
import { UnitOfWork } from '../model/unitOfWork.ts';
import { useActions } from '../react-app/context/ActionsContext.tsx';
import { Tool } from '../react-canvas-editor/tools/types.ts';
import { ControlPoints } from '../model/types.ts';

export type EdgeApi = {
  repaint: () => void;
};

export const Edge = forwardRef<EdgeApi, Props>((props, ref) => {
  const redraw = useRedraw();
  const drag = useDragDrop();
  const { actionMap } = useActions();

  const { defaults } = useConfiguration();

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
      props.diagram.viewBox.toDiagramPoint(EventHelper.point(event.nativeEvent)),
      props.def.id,
      event.nativeEvent
    );
  };

  const isSelected = props.diagram.selectionState.elements.includes(props.def);
  const isSingleSelected = isSelected && props.diagram.selectionState.elements.length === 1;
  const firstEdge = props.diagram.selectionState.edges[0];

  const edgeProps = deepMerge({}, defaults.edge, props.def.props) as DeepRequired<EdgeProps>;

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

  const path = applyLineHops(basePath, props.def, startArrow, endArrow, props.def.intersections);

  return (
    <g id={`edge-${props.def.id}`}>
      <ArrowMarker
        id={`s_${props.def.id}`}
        arrow={startArrow}
        width={width}
        color={color}
        fillColor={fillColor}
      />
      <ArrowMarker
        id={`e_${props.def.id}`}
        arrow={endArrow}
        width={width}
        color={color}
        fillColor={fillColor}
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
              const uow = new UnitOfWork(props.diagram);
              const idx = props.def.addWaypoint(
                { point: props.diagram.viewBox.toDiagramPoint(EventHelper.point(e.nativeEvent)) },
                uow
              );
              uow.commit();

              drag.initiate(new EdgeWaypointDrag(props.diagram, props.def, idx));
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
                drag.initiate(new EdgeWaypointDrag(props.diagram, props.def, idx));
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
