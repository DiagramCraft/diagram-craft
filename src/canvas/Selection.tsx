import { forwardRef, Fragment, useImperativeHandle } from 'react';
import { useRedraw } from './useRedraw.tsx';
import {
  EdgeEndpointMoveActions,
  resizeDragActions,
  rotateDragActions
} from './Selection.logic.ts';
import { Drag, DragActions } from './drag.ts';
import { DistanceMarker } from './DistanceMarker.tsx';
import { Point } from '../geometry/point.ts';
import { Line } from '../geometry/line.ts';
import { Angle } from '../geometry/angle.ts';
import { round } from '../utils/math.ts';
import { SelectionState } from '../model-editor/selectionState.ts';
import { AnchorType } from '../model-editor/snap/anchor.ts';
import { $c } from '../utils/classname.ts';

export type SelectionApi = {
  repaint: () => void;
};

const anchorTypeColor: Record<AnchorType, string> = {
  node: 'red',
  distance: 'pink',
  size: 'pink',
  canvas: 'green',
  source: 'black',
  grid: 'purple'
};

export const Selection = forwardRef<SelectionApi, Props>((props, ref) => {
  const redraw = useRedraw();

  useImperativeHandle(ref, () => {
    return {
      repaint: () => {
        redraw();
      }
    };
  });

  if (props.selection.isEmpty()) return null;

  const isOnlyEdges = props.selection.nodes.length === 0 && props.selection.edges.length > 0;

  const bounds = props.selection.bounds;

  const points: Point[] = [
    bounds.pos,
    {
      x: bounds.pos.x + bounds.size.w,
      y: bounds.pos.y
    },
    {
      x: bounds.pos.x + bounds.size.w,
      y: bounds.pos.y + bounds.size.h
    },
    {
      x: bounds.pos.x,
      y: bounds.pos.y + bounds.size.h
    },
    bounds.pos
  ];
  const pointsString = points.map(c => `${c.x},${c.y}`).join(' ');

  return (
    <>
      {!isOnlyEdges &&
        [
          ...props.selection.guides.filter(s => s.matchingAnchor.type !== 'distance'),
          ...props.selection.guides.filter(s => s.matchingAnchor.type === 'distance')
        ].map(g => {
          const l = Line.extend(g.line, 30, 30);
          const color = anchorTypeColor[g.matchingAnchor.type];
          return (
            <Fragment
              key={`u_${g.matchingAnchor.type}_${l.from.x},${l.from.y}-${l.to.x},${l.to.y}`}
            >
              <line
                x1={l.from.x}
                y1={l.from.y}
                x2={l.to.x}
                y2={l.to.y}
                strokeDasharray={'5 5'}
                strokeWidth={1}
                stroke={color}
              />

              <line
                x1={g.line.from.x}
                y1={g.line.from.y}
                x2={g.line.to.x}
                y2={g.line.to.y}
                strokeWidth={1}
                stroke={color}
              />

              {g.matchingAnchor.type === 'size' &&
                g.matchingAnchor.distancePairs.map(dp => {
                  const lbl = round(dp.distance).toString();
                  return (
                    <DistanceMarker
                      key={`a_${dp.pointA.x}_${dp.pointA.y}`}
                      id={`nd_${dp.pointA.x}_${dp.pointA.y}`}
                      x1={dp.pointA.x}
                      y1={dp.pointA.y}
                      x2={dp.pointB.x}
                      y2={dp.pointB.y}
                      color={'pink'}
                      label={lbl}
                    />
                  );
                })}

              {g.matchingAnchor.type === 'distance' &&
                g.matchingAnchor.distancePairs.map(dp => {
                  const lbl = round(dp.distance).toString();
                  return (
                    <DistanceMarker
                      key={`a_${dp.pointA.x}_${dp.pointA.y}`}
                      id={`nd_${dp.pointA.x}_${dp.pointA.y}`}
                      x1={dp.pointA.x}
                      y1={dp.pointA.y}
                      x2={dp.pointB.x}
                      y2={dp.pointB.y}
                      color={'pink'}
                      label={lbl}
                    />
                  );
                })}

              {/* TODO: These numbers are a bit of a hack */}
              {g.label !== undefined && (
                <>
                  <rect
                    x={Line.midpoint(g.line).x - g.label.length * 5}
                    y={Line.midpoint(g.line).y - 10}
                    width={g.label.length * 10}
                    height={16}
                    fill="white"
                  />
                  <text
                    x={Line.midpoint(g.line).x}
                    y={Line.midpoint(g.line).y}
                    fill="black"
                    style={{ fontSize: '10px' }}
                    dominantBaseline="middle"
                    textAnchor="middle"
                  >
                    {g.label}
                  </text>
                </>
              )}
            </Fragment>
          );
        })}
      <g
        transform={`rotate(${Angle.toDeg(bounds.rotation)} ${bounds.pos.x + bounds.size.w / 2} ${
          bounds.pos.y + bounds.size.h / 2
        })`}
      >
        <polyline
          points={pointsString}
          className={$c('selection-bb', { 'only-edges': isOnlyEdges })}
          fill="none"
          pointerEvents={'none'}
        />

        {!isOnlyEdges && (
          <>
            <line
              x1={Point.midpoint(points[0], points[1]).x}
              y1={Point.midpoint(points[0], points[1]).y}
              x2={Point.midpoint(points[0], points[1]).x}
              y2={Point.midpoint(points[0], points[1]).y - 20}
              className="selection-handle"
            />
            <circle
              cx={Point.midpoint(points[0], points[1]).x}
              cy={Point.midpoint(points[0], points[1]).y - 20}
              r="4"
              className="selection-handle"
              cursor={'n-resize'}
              onMouseDown={e => {
                if (e.button !== 0) return;
                props.onDragStart(Point.fromEvent(e.nativeEvent), 'rotate', rotateDragActions);
                e.stopPropagation();
              }}
            />
            <circle
              cx={points[0].x}
              cy={points[0].y}
              r="4"
              className="selection-handle"
              cursor={'nw-resize'}
              onMouseDown={e => {
                if (e.button !== 0) return;
                props.onDragStart(Point.fromEvent(e.nativeEvent), 'resize-nw', resizeDragActions);
                e.stopPropagation();
              }}
            />
            <circle
              cx={points[1].x}
              cy={points[1].y}
              r="4"
              className="selection-handle"
              cursor={'ne-resize'}
              onMouseDown={e => {
                if (e.button !== 0) return;
                props.onDragStart(Point.fromEvent(e.nativeEvent), 'resize-ne', resizeDragActions);
                e.stopPropagation();
              }}
            />
            <circle
              cx={points[2].x}
              cy={points[2].y}
              r="4"
              className="selection-handle"
              cursor={'se-resize'}
              onMouseDown={e => {
                if (e.button !== 0) return;
                props.onDragStart(Point.fromEvent(e.nativeEvent), 'resize-se', resizeDragActions);
                e.stopPropagation();
              }}
            />
            <circle
              cx={points[3].x}
              cy={points[3].y}
              r="4"
              className="selection-handle"
              cursor={'sw-resize'}
              onMouseDown={e => {
                if (e.button !== 0) return;
                props.onDragStart(Point.fromEvent(e.nativeEvent), 'resize-sw', resizeDragActions);
                e.stopPropagation();
              }}
            />
            <circle
              cx={Point.midpoint(points[0], points[1]).x}
              cy={Point.midpoint(points[0], points[1]).y}
              r="4"
              className="selection-handle"
              cursor={'n-resize'}
              onMouseDown={e => {
                if (e.button !== 0) return;
                props.onDragStart(Point.fromEvent(e.nativeEvent), 'resize-n', resizeDragActions);
                e.stopPropagation();
              }}
            />
            <circle
              cx={Point.midpoint(points[1], points[2]).x}
              cy={Point.midpoint(points[1], points[2]).y}
              r="4"
              className="selection-handle"
              cursor={'e-resize'}
              onMouseDown={e => {
                if (e.button !== 0) return;
                props.onDragStart(Point.fromEvent(e.nativeEvent), 'resize-e', resizeDragActions);
                e.stopPropagation();
              }}
            />
            ;
            <circle
              cx={Point.midpoint(points[2], points[3]).x}
              cy={Point.midpoint(points[2], points[3]).y}
              r="4"
              className="selection-handle"
              cursor={'s-resize'}
              onMouseDown={e => {
                if (e.button !== 0) return;
                props.onDragStart(Point.fromEvent(e.nativeEvent), 'resize-s', resizeDragActions);
                e.stopPropagation();
              }}
            />
            <circle
              cx={Point.midpoint(points[3], points[4]).x}
              cy={Point.midpoint(points[3], points[4]).y}
              r="4"
              className="selection-handle"
              cursor={'w-resize'}
              onMouseDown={e => {
                if (e.button !== 0) return;
                props.onDragStart(Point.fromEvent(e.nativeEvent), 'resize-w', resizeDragActions);
                e.stopPropagation();
              }}
            />
          </>
        )}
        {props.selection.edges.map(e => {
          return (
            <Fragment key={e.id}>
              <circle
                cx={e.startPosition.x}
                cy={e.startPosition.y}
                r="4"
                className={$c('selection-edge-handle', { connected: e.isStartConnected() })}
                onMouseDown={ev => {
                  if (ev.button !== 0) return;
                  props.onDragStart(
                    Point.fromEvent(ev.nativeEvent),
                    'move-edge-start',
                    new EdgeEndpointMoveActions(e, ev.currentTarget)
                  );
                  ev.stopPropagation();
                }}
              />
              <circle
                cx={e.endPosition.x}
                cy={e.endPosition.y}
                r="4"
                className={$c('selection-edge-handle', { connected: e.isEndConnected() })}
                onMouseDown={ev => {
                  if (ev.button !== 0) return;
                  props.onDragStart(
                    Point.fromEvent(ev.nativeEvent),
                    'move-edge-end',
                    new EdgeEndpointMoveActions(e, ev.currentTarget)
                  );
                  ev.stopPropagation();
                }}
              />
            </Fragment>
          );
        })}
      </g>
      {/*<SelectionDebug selection={props.selection} />*/}
    </>
  );
});

type Props = {
  selection: SelectionState;
  onDragStart: (coord: Point, type: Drag['type'], actions: DragActions) => void;
};
