import { Point } from '../geometry/geometry.ts';
import { forwardRef, useImperativeHandle } from 'react';
import { SelectionState } from '../model/selectionState.ts';
import { useRedraw } from './useRedraw.tsx';
import { Drag, DragActions } from './drag.ts';

export type SelectionApi = {
  repaint: () => void;
};

export const SelectionDebug = forwardRef<SelectionApi, Props>((props, ref) => {
  const redraw = useRedraw();

  useImperativeHandle(ref, () => {
    return {
      repaint: () => {
        redraw();
      }
    };
  });

  if (props.selection.isEmpty()) return null;

  return (
    <>
      {props.selection.anchors.map(g => {
        if (g.axis === 'h') {
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
    </>
  );
});

type Props = {
  selection: SelectionState;
  onDragStart: (coord: Point, type: Drag['type'], actions: DragActions) => void;
};
