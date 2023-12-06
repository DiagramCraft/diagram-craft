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
import { ARROW_SHAPES, ArrowShape } from '../base-ui/arrowShapes.ts';
import { invariant } from '../utils/assert.ts';
import { DASH_PATTERNS } from '../base-ui/dashPatterns.ts';
import { EventHelper } from '../base-ui/eventHelper.ts';

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
      props.onMouseDown(props.def.id, EventHelper.point(e.nativeEvent), e.nativeEvent);
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

  const color = props.def.props.stroke?.color ?? 'black';
  const fillColor = props.def.props.fill?.color ?? color;
  const pattern =
    DASH_PATTERNS[props.def.props.stroke?.pattern ?? 'SOLID']?.(
      (props.def.props?.stroke?.patternSize ?? 100) / 100,
      (props.def.props?.stroke?.patternSpacing ?? 100) / 100
    ) ?? '';
  const width = Number(props.def.props.stroke?.width ?? 1);

  const startArrowSize = (props.def.props.arrow?.start?.size ?? 100) / 100;
  const endArrowSize = (props.def.props.arrow?.end?.size ?? 100) / 100;

  const arrow1: ArrowShape | undefined =
    ARROW_SHAPES[props.def.props.arrow?.start?.type ?? '']?.(startArrowSize);
  const arrow2: ArrowShape | undefined =
    ARROW_SHAPES[props.def.props.arrow?.end?.type ?? '']?.(endArrowSize);

  let start: PointOnPath | undefined;
  let end: PointOnPath | undefined;

  // TODO: If we connect to any other than the anchor point, should we really clip?
  //       maybe we should make this a setting on the edge? or on the anchor?
  //       ... maybe there are three behaviors, clip, no-clip and attach to closest anchor
  const intersections: WithSegment<PointOnPath>[] = [];
  if (props.def.isEndConnected()) {
    const endEndpoint = props.def.end as ConnectedEndpoint;
    const endNode = endEndpoint.node;
    const anchor = endNode.anchors[endEndpoint.anchor];

    // TODO: Need to handle this better - maybe look for the closest intersection
    //       to the point - and if longer than a few pixels skip the intersection
    const endNodeDefinition = props.diagram.nodeDefinitions.get(endNode.nodeType);
    const endIntersections = path.intersections(endNodeDefinition.getBoundingPath(endNode));

    if (anchor.clip) {
      intersections.push(...endIntersections);
      // TODO: Handle multiple intersections
      end = endIntersections?.[0] ?? { point: props.def.endPosition };
    } else {
      const closeIntersections = endIntersections.filter(
        i =>
          Point.distance(props.def.endPosition, i.point) < 1.5 * (endNode.props.stroke?.width ?? 1)
      );
      if (closeIntersections) {
        intersections.push(...closeIntersections);
      }
      end = closeIntersections?.[0] ?? { point: props.def.endPosition };
    }
  }
  if (props.def.isStartConnected()) {
    const startEndpoint = props.def.start as ConnectedEndpoint;
    const startNode = startEndpoint.node;
    const anchor = startNode.anchors[startEndpoint.anchor];
    const startNodeDefinition = props.diagram.nodeDefinitions.get(startNode.nodeType);
    const startIntersections = path.intersections(startNodeDefinition.getBoundingPath(startNode));

    if (anchor.clip) {
      intersections.push(...startIntersections);
      // TODO: Handle multiple intersections
      start = startIntersections?.[0] ?? { point: props.def.startPosition };
    } else {
      const closeIntersections = startIntersections.filter(
        i =>
          Point.distance(props.def.startPosition, i.point) <
          1.5 * (startNode.props.stroke?.width ?? 1)
      );
      if (closeIntersections) {
        intersections.push(...closeIntersections);
      }
      start = closeIntersections?.[0] ?? { point: props.def.startPosition };
    }
  }

  if (start) {
    if (end) {
      let startOffset: TimeOffsetOnSegment | undefined;
      let endOffset: TimeOffsetOnSegment | undefined;

      if (arrow1) {
        const baseTOS = PointOnPath.toTimeOffset(start, path);
        const arrowL1 = TimeOffsetOnSegment.toLengthOffsetOnSegment(baseTOS, path);
        // TODO: This 1 is likely the stroke width of the edge
        arrowL1.segmentD += (arrow1.shortenBy ?? 0) + 1;

        startOffset = LengthOffsetOnSegment.toTimeOffsetOnSegment(arrowL1, path);
      } else {
        startOffset = PointOnPath.toTimeOffset(start, path);
      }

      if (arrow2) {
        const baseTOS = PointOnPath.toTimeOffset(end, path);
        const arrowL2 = TimeOffsetOnSegment.toLengthOffsetOnSegment(baseTOS, path);
        // TODO: This 1 is likely the stroke width of the edge
        arrowL2.segmentD -= (arrow2.shortenBy ?? 0) + 1;

        endOffset = LengthOffsetOnSegment.toTimeOffsetOnSegment(arrowL2, path);
      } else {
        endOffset = PointOnPath.toTimeOffset(end, path);
      }

      invariant.is.present(startOffset);
      invariant.is.present(endOffset);

      path = path.split(startOffset, endOffset)[1];
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
      {arrow1 && (
        <marker
          id={`marker_s_${props.def.id}`}
          viewBox={`${-1 * width} ${-1 * width} ${arrow1.width + 1 + width} ${
            arrow1.height + 1 + width
          }`}
          refX={arrow1.anchor.x}
          refY={arrow1.anchor.y}
          strokeLinejoin={'round'}
          strokeLinecap={'round'}
          markerUnits={'userSpaceOnUse'}
          markerWidth={arrow1.width + 2}
          markerHeight={arrow1.height + 2}
          orient="auto-start-reverse"
        >
          <path
            d={arrow1.path}
            stroke={color}
            strokeWidth={width}
            fill={arrow1.fill === 'fg' ? fillColor : arrow1.fill === 'bg' ? 'white' : 'none'}
          />
        </marker>
      )}
      {arrow2 && (
        <marker
          id={`marker_e_${props.def.id}`}
          viewBox={`${-1 * width} ${-1 * width} ${arrow2.width + 1 + width} ${
            arrow2.height + 1 + width
          }`}
          refX={arrow2.anchor.x}
          refY={arrow2.anchor.y}
          markerUnits={'userSpaceOnUse'}
          strokeLinejoin={'round'}
          strokeLinecap={'round'}
          markerWidth={arrow2.width + 2}
          markerHeight={arrow2.height + 2}
          orient="auto-start-reverse"
        >
          <path
            d={arrow2.path}
            stroke={color}
            strokeWidth={width}
            fill={arrow2.fill === 'fg' ? fillColor : arrow2.fill === 'bg' ? 'white' : 'none'}
          />
        </marker>
      )}

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
        stroke={color}
        onMouseDown={onMouseDown}
        onMouseEnter={() => props.onMouseEnter(props.def.id)}
        onMouseLeave={() => props.onMouseLeave(props.def.id)}
        onContextMenu={onContextMenu}
        strokeWidth={width}
        strokeDasharray={pattern}
        style={{ cursor: 'move', fill: 'none' }}
        markerStart={arrow1 ? `url(#marker_s_${props.def.id})` : undefined}
        markerEnd={arrow2 ? `url(#marker_e_${props.def.id})` : undefined}
      />

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
