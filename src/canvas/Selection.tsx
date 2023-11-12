import { Angle, Line, Point, round } from '../geometry/geometry.ts';
import { forwardRef, Fragment, useImperativeHandle } from 'react';
import { SelectionState } from '../model/selectionState.ts';
import { useRedraw } from './useRedraw.tsx';
import { resizeDragActions, rotateDragActions } from './Selection.logic.ts';
import { Drag, DragActions } from './drag.ts';

export type SelectionApi = {
  repaint: () => void;
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
      {/*
      {props.selection.anchors.map(g => {
        if (g.axis === 'x') {
          return (
            <line
              key={`x_${g.pos.y}`}
              x1={0}
              y1={g.pos.y}
              x2={'640'}
              y2={g.pos.y}
              strokeDasharray={'5 5'}
              stroke={'gray'}
            />
          );
        } else {
          return (
            <line
              key={`y_${g.pos.x}`}
              x1={g.pos.x}
              y1={0}
              x2={g.pos.x}
              y2={480}
              strokeDasharray={'5 5'}
              stroke={'gray'}
            />
          );
        }
      })}

      {props.selection.anchors.map(g => (
        <circle
          key={`${g.pos.x}_${g.pos.y}`}
          cx={g.pos.x}
          cy={g.pos.y}
          r="4"
          fill="pink"
          strokeWidth={1}
          stroke="black"
        />
      ))}
      */}

      {props.selection.guides.map(g => {
        const l = Line.extend(g.line, 30, 30);
        const color = g.type === 'node' ? 'red' : g.type === 'distance' ? 'pink' : 'green';
        return (
          <Fragment key={`u_${g.type}_${l.from.x},${l.from.y}-${l.to.x},${l.to.y}`}>
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

            {g.matchingAnchor.type === 'distance' &&
              g.matchingAnchor.distancePairs.map(dp => {
                const l = Line.from(dp.pointA, dp.pointB);
                const lbl = round(dp.distance).toString();
                return (
                  <Fragment key={`a_${dp.pointA.x}_${dp.pointA.y}`}>
                    <marker
                      id={`arrow_${dp.pointA.x}_${dp.pointA.y}`}
                      viewBox="0 0 10 10"
                      refX="10"
                      refY="5"
                      markerWidth="6"
                      markerHeight="6"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 0 L 10 5 L 0 10 z" stroke="red" fill="red" />
                    </marker>

                    <line
                      x1={dp.pointA.x}
                      y1={dp.pointA.y}
                      x2={dp.pointB.x}
                      y2={dp.pointB.y}
                      strokeWidth={1}
                      stroke={'red'}
                      fill={'red'}
                      markerEnd={`url(#arrow_${dp.pointA.x}_${dp.pointA.y})`}
                      markerStart={`url(#arrow_${dp.pointA.x}_${dp.pointA.y})`}
                    />
                    <rect
                      x={Line.midpoint(l).x - lbl.length * 5}
                      y={Line.midpoint(l).y - 10}
                      width={lbl.length * 10}
                      height={17}
                      fill="white"
                    />
                    <text
                      x={Line.midpoint(l).x}
                      y={Line.midpoint(l).y}
                      fill="blue"
                      style={{ fontSize: '10px' }}
                      dominantBaseline="middle"
                      textAnchor="middle"
                    >
                      {lbl}
                    </text>
                  </Fragment>
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
          style={{ stroke: '#2673dd', strokeWidth: '1' }}
          fill="none"
        />

        <line
          x1={Point.midpoint(points[0], points[1]).x}
          y1={Point.midpoint(points[0], points[1]).y}
          x2={Point.midpoint(points[0], points[1]).x}
          y2={Point.midpoint(points[0], points[1]).y - 20}
          strokeWidth={1}
          stroke="#2673dd"
        />

        <circle
          cx={points[0].x}
          cy={points[0].y}
          r="4"
          fill="white"
          strokeWidth={1}
          stroke="#2673dd"
          style={{ cursor: 'nw-resize' }}
          onMouseDown={e => {
            props.onDragStart(Point.fromEvent(e.nativeEvent), 'resize-nw', resizeDragActions);
            e.stopPropagation();
          }}
        />

        <circle
          cx={points[1].x}
          cy={points[1].y}
          r="4"
          fill="white"
          strokeWidth={1}
          stroke="#2673dd"
          style={{ cursor: 'ne-resize' }}
          onMouseDown={e => {
            props.onDragStart(Point.fromEvent(e.nativeEvent), 'resize-ne', resizeDragActions);
            e.stopPropagation();
          }}
        />

        <circle
          cx={points[2].x}
          cy={points[2].y}
          r="4"
          fill="white"
          strokeWidth={1}
          stroke="#2673dd"
          style={{ cursor: 'se-resize' }}
          onMouseDown={e => {
            props.onDragStart(Point.fromEvent(e.nativeEvent), 'resize-se', resizeDragActions);
            e.stopPropagation();
          }}
        />

        <circle
          cx={points[3].x}
          cy={points[3].y}
          r="4"
          fill="white"
          strokeWidth={1}
          stroke="#2673dd"
          style={{ cursor: 'sw-resize' }}
          onMouseDown={e => {
            props.onDragStart(Point.fromEvent(e.nativeEvent), 'resize-sw', resizeDragActions);
            e.stopPropagation();
          }}
        />

        <circle
          cx={Point.midpoint(points[0], points[1]).x}
          cy={Point.midpoint(points[0], points[1]).y}
          r="4"
          fill="white"
          strokeWidth={1}
          stroke="#2673dd"
          style={{ cursor: 'n-resize' }}
          onMouseDown={e => {
            props.onDragStart(Point.fromEvent(e.nativeEvent), 'resize-n', resizeDragActions);
            e.stopPropagation();
          }}
        />

        <circle
          cx={Point.midpoint(points[0], points[1]).x}
          cy={Point.midpoint(points[0], points[1]).y - 20}
          r="4"
          fill="white"
          strokeWidth={1}
          stroke="#2673dd"
          style={{ cursor: 'ew-resize' }}
          onMouseDown={e => {
            props.onDragStart(Point.fromEvent(e.nativeEvent), 'rotate', rotateDragActions);
            e.stopPropagation();
          }}
        />

        <circle
          cx={Point.midpoint(points[1], points[2]).x}
          cy={Point.midpoint(points[1], points[2]).y}
          r="4"
          fill="white"
          strokeWidth={1}
          stroke="#2673dd"
          style={{ cursor: 'e-resize' }}
          onMouseDown={e => {
            props.onDragStart(Point.fromEvent(e.nativeEvent), 'resize-e', resizeDragActions);
            e.stopPropagation();
          }}
        />

        <circle
          cx={Point.midpoint(points[2], points[3]).x}
          cy={Point.midpoint(points[2], points[3]).y}
          r="4"
          fill="white"
          strokeWidth={1}
          stroke="#2673dd"
          style={{ cursor: 's-resize' }}
          onMouseDown={e => {
            props.onDragStart(Point.fromEvent(e.nativeEvent), 'resize-s', resizeDragActions);
            e.stopPropagation();
          }}
        />

        <circle
          cx={Point.midpoint(points[3], points[4]).x}
          cy={Point.midpoint(points[3], points[4]).y}
          r="4"
          fill="white"
          strokeWidth={1}
          stroke="#2673dd"
          style={{ cursor: 'w-resize' }}
          onMouseDown={e => {
            props.onDragStart(Point.fromEvent(e.nativeEvent), 'resize-w', resizeDragActions);
            e.stopPropagation();
          }}
        />
      </g>
    </>
  );
});

type Props = {
  selection: SelectionState;
  onDragStart: (coord: Point, type: Drag['type'], actions: DragActions) => void;
};
