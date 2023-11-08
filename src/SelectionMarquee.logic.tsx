import { Drag, SelectionState } from './state.ts';
import { LoadedDiagram, ResolvedNodeDef } from './model/diagram.ts';
import { precondition } from './assert.ts';
import { Box, Point } from './geometry.ts';

const updatePendingElements = (selection: SelectionState, diagram: LoadedDiagram) => {
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

export const marqueeDragActions = {
  onDrag: (coord: Point, drag: Drag, diagram: LoadedDiagram, selection: SelectionState) => {
    selection.marquee = Box.normalize({
      pos: drag.offset,
      size: { w: coord.x - drag.offset.x, h: coord.y - drag.offset.y },
      rotation: 0
    });

    updatePendingElements(selection, diagram);
  },
  onDragEnd: (_coord: Point, _drag: Drag, _diagram: LoadedDiagram, selection: SelectionState) => {
    if (selection.pendingElements) {
      selection.convertMarqueeToSelection();
    }
  }
};
