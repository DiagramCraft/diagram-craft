import { Box, Coord } from './geometry.ts';
import { forwardRef, useImperativeHandle, useState } from 'react';
import { Drag, SelectionState } from './state.ts';
import { NodeDef } from './diagram.ts';

export type SelectionApi = {
  repaint: () => void;
};

export const selectionResize = (coord: Coord, selection: SelectionState, drag: Drag) => {
  const delta = Coord.subtract(coord, drag.offset);

  const before = Box.snapshot(selection);

  if (drag.type === 'resize-e') {
    selection.size.w = drag.original.size.w + delta.x;
  } else if (drag.type === 'resize-w') {
    selection.size.w = drag.original.size.w - delta.x;
    selection.pos.x = drag.original.pos.x + delta.x;
  } else if (drag.type === 'resize-n') {
    selection.size.h = drag.original.size.h - delta.y;
    selection.pos.y = drag.original.pos.y + delta.y;
  } else if (drag.type === 'resize-s') {
    selection.size.h = drag.original.size.h + delta.y;
  } else if (drag.type === 'resize-nw') {
    selection.size.h = drag.original.size.h - delta.y;
    selection.pos.y = drag.original.pos.y + delta.y;
    selection.size.w = drag.original.size.w - delta.x;
    selection.pos.x = drag.original.pos.x + delta.x;
  } else if (drag.type === 'resize-ne') {
    selection.size.h = drag.original.size.h - delta.y;
    selection.pos.y = drag.original.pos.y + delta.y;
    selection.size.w = drag.original.size.w + delta.x;
  } else if (drag.type === 'resize-se') {
    selection.size.h = drag.original.size.h + delta.y;
    selection.size.w = drag.original.size.w + delta.x;
  } else if (drag.type === 'resize-sw') {
    selection.size.h = drag.original.size.h + delta.y;
    selection.size.w = drag.original.size.w - delta.x;
    selection.pos.x = drag.original.pos.x + delta.x;
  }

  for (const node of selection.elements) {
    NodeDef.transform(node, before, selection);
  }
};

export const Selection = forwardRef<SelectionApi, Props>((props, ref) => {
  const [redraw, setRedraw] = useState(1);

  useImperativeHandle(ref, () => {
    return {
      repaint: () => {
        setRedraw(redraw + 1);
      }
    };
  });

  if (SelectionState.isEmpty(props.selection)) return null;

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
    <>
      <polyline points={pointsString} style={{ stroke: 'blue', strokeWidth: '1' }} fill="none" />

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
    </>
  );
});

type Props = {
  selection: SelectionState;
  onDragStart: (coord: Coord, type: Drag['type'], original: Box) => void;
};
