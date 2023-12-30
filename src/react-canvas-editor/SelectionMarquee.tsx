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
        x={bounds.pos.x}
        y={bounds.pos.y}
        width={bounds.size.w}
        height={bounds.size.h}
      />

      {props.selection.marquee.pendingElements?.map(e => (
        <rect
          key={e.id}
          className={'svg-marquee__element'}
          x={e.bounds.pos.x}
          y={e.bounds.pos.y}
          width={e.bounds.size.w}
          height={e.bounds.size.h}
          transform={`rotate(${Angle.toDeg(e.bounds.rotation)} ${
            e.bounds.pos.x + e.bounds.size.w / 2
          } ${e.bounds.pos.y + e.bounds.size.h / 2})`}
        />
      ))}
    </>
  );
});

type Props = {
  selection: SelectionState;
};
