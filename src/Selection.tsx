import { Box, Coord } from './geometry.ts';
import { forwardRef, useImperativeHandle } from 'react';
import { Drag, SelectionState } from './state.ts';
import { useRedraw } from './useRedraw.tsx';

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

  const points: Coord[] = [
    props.selection.pos,
    {
      x: props.selection.pos.x + props.selection.size.w,
      y: props.selection.pos.y
    },
    {
      x: props.selection.pos.x + props.selection.size.w,
      y: props.selection.pos.y + props.selection.size.h
    },
    {
      x: props.selection.pos.x,
      y: props.selection.pos.y + props.selection.size.h
    },
    props.selection.pos
  ];
  const pointsString = points.map(c => `${c.x},${c.y}`).join(' ');

  return (
    <g
      transform={`rotate(${props.selection.rotation ?? 0} ${
        props.selection.pos.x + props.selection.size.w / 2
      } ${props.selection.pos.y + props.selection.size.h / 2})`}
    >
      <polyline points={pointsString} style={{ stroke: 'blue', strokeWidth: '1' }} fill="none" />

      <line
        x1={Coord.midpoint(points[0], points[1]).x}
        y1={Coord.midpoint(points[0], points[1]).y}
        x2={Coord.midpoint(points[0], points[1]).x}
        y2={Coord.midpoint(points[0], points[1]).y - 20}
        strokeWidth={1}
        stroke="blue"
      />

      <circle
        cx={points[0].x}
        cy={points[0].y}
        r="4"
        fill="white"
        strokeWidth={1}
        stroke="blue"
        style={{ cursor: 'nw-resize' }}
        onMouseDown={e => {
          props.onDragStart(
            Coord.fromEvent(e.nativeEvent),
            'resize-nw',
            Box.snapshot(props.selection)
          );
          e.stopPropagation();
        }}
      />

      <circle
        cx={points[1].x}
        cy={points[1].y}
        r="4"
        fill="white"
        strokeWidth={1}
        stroke="blue"
        style={{ cursor: 'ne-resize' }}
        onMouseDown={e => {
          props.onDragStart(
            Coord.fromEvent(e.nativeEvent),
            'resize-ne',
            Box.snapshot(props.selection)
          );
          e.stopPropagation();
        }}
      />

      <circle
        cx={points[2].x}
        cy={points[2].y}
        r="4"
        fill="white"
        strokeWidth={1}
        stroke="blue"
        style={{ cursor: 'se-resize' }}
        onMouseDown={e => {
          props.onDragStart(
            Coord.fromEvent(e.nativeEvent),
            'resize-se',
            Box.snapshot(props.selection)
          );
          e.stopPropagation();
        }}
      />

      <circle
        cx={points[3].x}
        cy={points[3].y}
        r="4"
        fill="white"
        strokeWidth={1}
        stroke="blue"
        style={{ cursor: 'sw-resize' }}
        onMouseDown={e => {
          props.onDragStart(
            Coord.fromEvent(e.nativeEvent),
            'resize-sw',
            Box.snapshot(props.selection)
          );
          e.stopPropagation();
        }}
      />

      <circle
        cx={Coord.midpoint(points[0], points[1]).x}
        cy={Coord.midpoint(points[0], points[1]).y}
        r="4"
        fill="white"
        strokeWidth={1}
        stroke="blue"
        style={{ cursor: 'n-resize' }}
        onMouseDown={e => {
          props.onDragStart(
            Coord.fromEvent(e.nativeEvent),
            'resize-n',
            Box.snapshot(props.selection)
          );
          e.stopPropagation();
        }}
      />

      <circle
        cx={Coord.midpoint(points[0], points[1]).x}
        cy={Coord.midpoint(points[0], points[1]).y - 20}
        r="4"
        fill="white"
        strokeWidth={1}
        stroke="blue"
        style={{ cursor: 'ew-resize' }}
        onMouseDown={e => {
          props.onDragStart(
            Coord.fromEvent(e.nativeEvent),
            'rotate',
            Box.snapshot(props.selection)
          );
          e.stopPropagation();
        }}
      />

      <circle
        cx={Coord.midpoint(points[1], points[2]).x}
        cy={Coord.midpoint(points[1], points[2]).y}
        r="4"
        fill="white"
        strokeWidth={1}
        stroke="blue"
        style={{ cursor: 'e-resize' }}
        onMouseDown={e => {
          props.onDragStart(
            Coord.fromEvent(e.nativeEvent),
            'resize-e',
            Box.snapshot(props.selection)
          );
          e.stopPropagation();
        }}
      />

      <circle
        cx={Coord.midpoint(points[2], points[3]).x}
        cy={Coord.midpoint(points[2], points[3]).y}
        r="4"
        fill="white"
        strokeWidth={1}
        stroke="blue"
        style={{ cursor: 's-resize' }}
        onMouseDown={e => {
          props.onDragStart(
            Coord.fromEvent(e.nativeEvent),
            'resize-s',
            Box.snapshot(props.selection)
          );
          e.stopPropagation();
        }}
      />

      <circle
        cx={Coord.midpoint(points[3], points[4]).x}
        cy={Coord.midpoint(points[3], points[4]).y}
        r="4"
        fill="white"
        strokeWidth={1}
        stroke="blue"
        style={{ cursor: 'w-resize' }}
        onMouseDown={e => {
          props.onDragStart(
            Coord.fromEvent(e.nativeEvent),
            'resize-w',
            Box.snapshot(props.selection)
          );
          e.stopPropagation();
        }}
      />
    </g>
  );
});

type Props = {
  selection: SelectionState;
  onDragStart: (coord: Coord, type: Drag['type'], original: Box) => void;
};
