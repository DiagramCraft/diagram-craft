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

  const bounds = props.selection.marquee.bounds;
  if (!bounds) return null;

  return (
    <>
      <rect
        className={'svg-marquee'}
        x={bounds.x}
        y={bounds.y}
        width={bounds.w}
        height={bounds.h}
      />

      {props.selection.marquee.pendingElements?.map(e => (
        <rect
          key={e.id}
          className={'svg-marquee__element'}
          x={e.bounds.x}
          y={e.bounds.y}
          width={e.bounds.w}
          height={e.bounds.h}
          transform={`rotate(${Angle.toDeg(e.bounds.r)} ${e.bounds.x + e.bounds.w / 2} ${
            e.bounds.y + e.bounds.h / 2
          })`}
        />
      ))}
    </>
  );
});

type Props = {
  selection: SelectionState;
};
