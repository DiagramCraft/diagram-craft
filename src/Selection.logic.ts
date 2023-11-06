import { Box, Point, Vector } from './geometry.ts';
import { ResizeDrag, SelectionState } from './state.ts';
import { NodeDef } from './model/diagram.ts';

export const selectionResize = (coord: Point, selection: SelectionState, drag: ResizeDrag) => {
  const delta = Point.subtract(coord, drag.offset);
  const before = Box.snapshot(selection);
  const original = selection.source.boundingBox;

  if (drag.type === 'resize-e') {
    selection.size.w = original.size.w + delta.x;
  } else if (drag.type === 'resize-w') {
    selection.size.w = original.size.w - delta.x;
    selection.pos.x = original.pos.x + delta.x;
  } else if (drag.type === 'resize-n') {
    selection.size.h = original.size.h - delta.y;
    selection.pos.y = original.pos.y + delta.y;
  } else if (drag.type === 'resize-s') {
    selection.size.h = original.size.h + delta.y;
  } else if (drag.type === 'resize-nw') {
    selection.size.h = original.size.h - delta.y;
    selection.pos.y = original.pos.y + delta.y;
    selection.size.w = original.size.w - delta.x;
    selection.pos.x = original.pos.x + delta.x;
  } else if (drag.type === 'resize-ne') {
    selection.size.h = original.size.h - delta.y;
    selection.pos.y = original.pos.y + delta.y;
    selection.size.w = original.size.w + delta.x;
  } else if (drag.type === 'resize-se') {
    selection.size.h = original.size.h + delta.y;
    selection.size.w = original.size.w + delta.x;
  } else if (drag.type === 'resize-sw') {
    selection.size.h = original.size.h + delta.y;
    selection.size.w = original.size.w - delta.x;
    selection.pos.x = original.pos.x + delta.x;
  }

  for (const node of selection.elements) {
    NodeDef.transform(node, before, selection);
  }
};

export const selectionRotate = (coord: Point, selection: SelectionState) => {
  const before = Box.snapshot(selection);

  const center = Box.center(selection.source.boundingBox);
  selection.rotation = Vector.angle(Vector.from(center, coord));

  for (const node of selection.elements) {
    NodeDef.transform(node, before, selection);
  }
};
