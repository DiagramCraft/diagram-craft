import { forwardRef, useImperativeHandle } from 'react';
import { SelectionState } from './state.ts';
import { useRedraw } from './useRedraw.tsx';
import { LoadedDiagram, ResolvedNodeDef } from './model/diagram.ts';
import { Angle, Box } from './geometry.ts';
import { precondition } from './assert.ts';

export type SelectionMarqueeApi = {
  repaint: () => void;
};

export const updatePendingElements = (selection: SelectionState, diagram: LoadedDiagram) => {
  precondition.is.present(selection.marquee);

  const pending: ResolvedNodeDef[] = [];
  for (const e of diagram.elements) {
    if (e.type !== 'node') continue;

    // if (Box.intersects(selection.marquee!, e)) {
    if (Box.contains(selection.marquee, e.bounds)) {
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
        fill="rgba(43, 117, 221, 0.2)"
        style={{ stroke: '#2673dd' }}
      />

      {props.selection.pendingElements?.map(e => (
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
