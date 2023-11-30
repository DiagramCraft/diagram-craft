import React, { forwardRef, MouseEventHandler, useCallback, useImperativeHandle } from 'react';
import { ConnectedEndpoint, DiagramEdge } from '../model-viewer/diagram.ts';
import { useRedraw } from './useRedraw.tsx';
import { Point } from '../geometry/point.ts';
import { Drag, Modifiers } from '../base-ui/drag.ts';
import { buildEdgePath } from '../base-ui/edgePathBuilder.ts';
import { EditableDiagram } from '../model-editor/editable-diagram.ts';
import { useDragDrop } from './DragDropManager.tsx';
import { ContextMenuEvent } from '../react-canvas-editor/EditableCanvas.tsx';
import {
  LengthOffsetOnSegment,
  PointOnPath,
  TimeOffsetOnSegment,
  WithSegment
} from '../geometry/pathPosition.ts';
import { ARROW_SHAPES } from '../base-ui/arrowShapes.ts';

class EdgeWaypointDrag implements Drag {
  constructor(
    private readonly edge: DiagramEdge,
    private readonly waypointIdx: number
  ) {}

  onDrag(coord: Point, _diagram: EditableDiagram, _modifiers: Modifiers) {
    this.edge.waypoints![this.waypointIdx].point = coord;
    _diagram.updateElement(this.edge);
  }

  onDragEnd(_coord: Point, _diagram: EditableDiagram): void {}
}

class BezierControlPointDrag implements Drag {
  constructor(
    private readonly edge: DiagramEdge,
    private readonly waypointIdx: number,
    private readonly controlPointIdx: number
  ) {}

  onDrag(coord: Point, _diagram: EditableDiagram, _modifiers: Modifiers) {
    const wp = this.edge.waypoints![this.waypointIdx];

    const cIdx = this.controlPointIdx;
    const ocIdx = cIdx === 0 ? 1 : 0;

    wp.controlPoints![cIdx] = Point.subtract(coord, wp!.point);
    wp.controlPoints![ocIdx] = {
      x: wp.controlPoints![cIdx].x * -1,
      y: wp.controlPoints![cIdx].y * -1
    };

    _diagram.updateElement(this.edge);
  }

  onDragEnd(_coord: Point, _diagram: EditableDiagram): void {}
}

export type EdgeApi = {
  repaint: () => void;
};

export const Edge = forwardRef<EdgeApi, Props>((props, ref) => {
  const redraw = useRedraw();
  const drag = useDragDrop();

  useImperativeHandle(ref, () => {
    return {
      repaint: () => {
        redraw();
      }
    };
  });

  const onMouseDown = useCallback<MouseEventHandler>(
    e => {
      if (e.button !== 0) return;
      props.onMouseDown(props.def.id, Point.fromEvent(e.nativeEvent), e.nativeEvent);
      e.stopPropagation();

      return false;
    },
    [props]
  );

  let path = buildEdgePath(props.def);

  const isSelected =
    props.diagram instanceof EditableDiagram &&
    props.diagram.selectionState.elements.includes(props.def);
  const isSingleSelected =
    isSelected &&
    props.diagram instanceof EditableDiagram &&
    props.diagram.selectionState.elements.length === 1;

  const arrow1 = ARROW_SHAPES['SOCKET'](1);

  let start: PointOnPath | undefined;
  let end: PointOnPath | undefined;

  const intersections: WithSegment<PointOnPath>[] = [];
  if (props.def.isEndConnected()) {
    const endNode = (props.def.end as ConnectedEndpoint).node;
    const endNodeDefinition = props.diagram.nodDefinitions.get(endNode.nodeType);
    const endIntersections = path.intersections(endNodeDefinition.getBoundingPath(endNode));
    intersections.push(...endIntersections);

    // TODO: Handle multiple intersections
    end = endIntersections?.[0] ?? { point: props.def.endPosition };
  }
  if (props.def.isStartConnected()) {
    const startNode = (props.def.start as ConnectedEndpoint).node;
    const startNodeDefinition = props.diagram.nodDefinitions.get(startNode.nodeType);
    const startIntersections = path.intersections(startNodeDefinition.getBoundingPath(startNode));
    intersections.push(...startIntersections);

    // TODO: Handle multiple intersections
    start = startIntersections?.[0] ?? { point: props.def.startPosition };
  }
  /*
  const projections = intersections.map(i => {
    return path.projectPoint(i.point);
  });*/

  if (start) {
    if (end) {
      const l = TimeOffsetOnSegment.toLengthOffsetOnSegment(
        PointOnPath.toTimeOffset(start, path),
        path
      );
      // TODO: This 1 is likely the stroke width of the edge
      l.segmentD += (arrow1.shortenBy ?? 0) + 1;

      const newStart = TimeOffsetOnSegment.toPointOnPath(
        LengthOffsetOnSegment.toTimeOffsetOnSegment(l, path),
        path
      );

      path = path.split(
        PointOnPath.toTimeOffset(newStart, path),
        PointOnPath.toTimeOffset(end, path)
      )[1];
    } else {
      path = path.split(PointOnPath.toTimeOffset(start, path))[1];
    }
  }

  const onContextMenu = (event: React.MouseEvent<SVGPathElement, MouseEvent>) => {
    const e = event as ContextMenuEvent & React.MouseEvent<SVGPathElement, MouseEvent>;
    const point = { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY };
    e.contextMenuTarget = {
      type: 'edge',
      id: props.def.id,
      pos: props.diagram.viewBox.toDiagramPoint(point)
    };
  };

  return (
    <g>
      <marker
        id={`marker_s_${props.def.id}`}
        viewBox={`-1 -1 ${arrow1.width + 2} ${arrow1.height + 2}`}
        refX={arrow1.anchor.x}
        refY={arrow1.anchor.y}
        markerUnits={'userSpaceOnUse'}
        markerWidth={arrow1.width + 2}
        markerHeight={arrow1.height + 2}
        orient="auto-start-reverse"
      >
        <path
          d={arrow1.path}
          stroke="black"
          strokeWidth={1}
          fill={arrow1.fill === 'fg' ? 'black' : arrow1.fill === 'bg' ? 'white' : 'none'}
        />
      </marker>
      <marker
        id={`marker_e_${props.def.id}`}
        viewBox="0 0 10 10"
        refX="10"
        refY="5"
        markerWidth="6"
        markerHeight="6"
        orient="auto-start-reverse"
      >
        <path d="M 0 0 L 10 5 L 0 10 z" stroke="black" fill="black" />
      </marker>

      <path
        d={path.asSvgPath()}
        stroke={'transparent'}
        strokeWidth={15}
        onMouseDown={onMouseDown}
        onMouseEnter={() => props.onMouseEnter(props.def.id)}
        onMouseLeave={() => props.onMouseLeave(props.def.id)}
        onContextMenu={onContextMenu}
        style={{ cursor: 'move', fill: 'none' }}
      />
      <path
        d={path.asSvgPath()}
        stroke={'black'}
        onMouseDown={onMouseDown}
        onMouseEnter={() => props.onMouseEnter(props.def.id)}
        onMouseLeave={() => props.onMouseLeave(props.def.id)}
        onContextMenu={onContextMenu}
        strokeWidth={'1'}
        style={{ cursor: 'move', fill: 'none' }}
        markerEnd={`url(#marker_e_${props.def.id})`}
        markerStart={`url(#marker_s_${props.def.id})`}
      />

      {/*intersections.map((i, idx) => (
        <circle
          key={`i_${idx}`}
          cx={i.point.x}
          cy={i.point.y}
          r="10"
          fill={'none'}
          stroke={'red'}
        />
      ))}

      {projections.map((i, idx) => (
        <circle
          key={`i_${idx}`}
          cx={i.point.x}
          cy={i.point.y}
          r="7"
          fill={'none'}
          stroke={'green'}
        />
      ))*/}

      {isSingleSelected && (
        <>
          {props.diagram.selectionState.edges[0].waypoints?.map((wp, idx) => (
            <circle
              key={`wp_${wp.point.x}_${wp.point.y}`}
              cx={wp.point.x}
              cy={wp.point.y}
              r="4"
              className="svg-waypoint-handle"
              cursor={'move'}
              onMouseDown={e => {
                if (e.button !== 0) return;

                drag.initiateDrag(new EdgeWaypointDrag(props.def, idx));
                e.stopPropagation();

                return false;
              }}
              onContextMenu={onContextMenu}
            />
          ))}
          {props.diagram.selectionState.edges[0].props.type === 'bezier' &&
            props.diagram.selectionState.edges[0].waypoints?.map((wp, idx) => {
              const controlPoints = wp.controlPoints ?? [];
              return controlPoints.map((cp, cIdx) => {
                return (
                  <React.Fragment key={`cp_bz_${idx}_${cp.x}_${cp.y}`}>
                    <line
                      x1={wp.point.x + cp.x}
                      y1={wp.point.y + cp.y}
                      x2={wp.point.x}
                      y2={wp.point.y}
                      className="svg-bezier-handle-line"
                      cursor={'move'}
                    />
                    <circle
                      cx={wp.point.x + cp.x}
                      cy={wp.point.y + cp.y}
                      r="4"
                      className="svg-bezier-handle"
                      cursor={'move'}
                      onMouseDown={e => {
                        if (e.button !== 0) return;

                        drag.initiateDrag(new BezierControlPointDrag(props.def, idx, cIdx));
                        e.stopPropagation();

                        return false;
                      }}
                    />
                  </React.Fragment>
                );
              });
            })}
        </>
      )}
    </g>
  );
});

type Props = {
  def: DiagramEdge;
  diagram: EditableDiagram;
  onMouseDown: (id: string, coord: Point, modifiers: Modifiers) => void;
  onMouseEnter: (id: string) => void;
  onMouseLeave: (id: string) => void;
};
