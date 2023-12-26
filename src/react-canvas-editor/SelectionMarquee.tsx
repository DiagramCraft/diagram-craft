import { forwardRef, useImperativeHandle } from 'react';
import { useRedraw } from '../react-canvas-viewer/useRedraw.tsx';
import { Angle } from '../geometry/angle.ts';
import { SelectionState } from '../model/selectionState.ts';
import { useEventListener } from '../react-app/hooks/useEventListener.ts';

export type SelectionMarqueeApi = {
  repaint: () => void;
};

export const SelectionMarquee = forwardRef<SelectionMarqueeApi, Props>((props, ref) => {
  const redraw = useRedraw();

  useImperativeHandle(ref, () => {
    return {
      repaint: () => {
        redraw();
      }
    };
  });

  useEventListener(props.selection.marquee, 'change', redraw);

  if (!props.selection.marquee.bounds) return null;

  return (
    <>
      <rect
        x={props.selection.marquee.bounds.pos.x}
        y={props.selection.marquee.bounds.pos.y}
        width={props.selection.marquee.bounds.size.w}
        height={props.selection.marquee.bounds.size.h}
        fill="rgba(43, 117, 221, 0.2)"
        style={{ stroke: '#2673dd' }}
      />

      {props.selection.marquee.pendingElements?.map(e => (
        <rect
          key={e.id}
          x={e.bounds.pos.x}
          y={e.bounds.pos.y}
          width={e.bounds.size.w}
          height={e.bounds.size.h}
          transform={`rotate(${Angle.toDeg(e.bounds.rotation)} ${
            e.bounds.pos.x + e.bounds.size.w / 2
          } ${e.bounds.pos.y + e.bounds.size.h / 2})`}
          fill="transparent"
          stroke={'#2673dd'}
        />
      ))}
    </>
  );
});

type Props = {
  selection: SelectionState;
};
