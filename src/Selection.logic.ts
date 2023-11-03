import { Box, Coord } from './geometry.ts';
import { ObjectDrag, SelectionState } from './state.ts';
import { NodeDef } from './diagram.ts';

export const selectionResize = (coord: Coord, selection: SelectionState, drag: ObjectDrag) => {
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
  } else if (drag.type === 'rotate') {
    const center = Box.center(drag.original);
    selection.rotation = Coord.angle(center, coord);
  }

  for (const node of selection.elements) {
    NodeDef.transform(node, before, selection);
  }
};
