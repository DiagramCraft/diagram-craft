import { forwardRef, useImperativeHandle } from 'react';
import { SelectionState } from './state.ts';
import { useRedraw } from './useRedraw.tsx';
import { LoadedDiagram, ResolvedNodeDef } from './diagram.ts';
import { Box } from './geometry.ts';

export type SelectionMarqueeApi = {
  repaint: () => void;
};

export const updatePendingElements = (selection: SelectionState, diagram: LoadedDiagram) => {
  const pending: ResolvedNodeDef[] = [];
  for (const e of diagram.elements) {
    if (e.type !== 'node') continue;

    if (Box.contains(selection.marquee, e)) {
      pending.push(e);
    }
  }
  selection.pendingElements = pending;
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

  if (!props.selection.marquee) return null;

  return (
    <>
      <rect
        x={props.selection.marquee.pos.x}
        y={props.selection.marquee.pos.y}
        width={props.selection.marquee.size.w}
        height={props.selection.marquee.size.h}
        fill="rgba(0, 0, 255, 0.2)"
        style={{ stroke: 'blue' }}
      />

      {props.selection.pendingElements?.map(e => (
        <rect
          key={e.id}
          x={e.pos.x}
          y={e.pos.y}
          width={e.size.w}
          height={e.size.h}
          transform={`rotate(${e.rotation ?? 0} ${e.pos.x + e.size.w / 2} ${
            e.pos.y + e.size.h / 2
          })`}
          fill="transparent"
          stroke={'blue'}
        />
      ))}
    </>
  );
});

type Props = {
  selection: SelectionState;
};
