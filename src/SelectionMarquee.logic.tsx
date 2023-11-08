import { SelectionState } from './state.ts';
import { LoadedDiagram, ResolvedNodeDef } from './model/diagram.ts';
import { precondition } from './assert.ts';
import { Box } from './geometry.ts';

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
  selection.setPendingElements(pending);
};
