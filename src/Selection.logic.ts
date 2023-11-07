import { Box, LocalCoordinateSystem, Point, Vector } from './geometry.ts';
import { ResizeDrag, SelectionState } from './state.ts';
import { NodeDef } from './model/diagram.ts';

export const selectionResize = (point: Point, selection: SelectionState, drag: ResizeDrag) => {
  const before = Box.snapshot(selection);
  const original = selection.source.boundingBox;

  const lcs = LocalCoordinateSystem.fromBox(selection);

  const localTarget = Box.asMutableSnapshot(lcs.toLocal(Box.snapshot(selection)));
  const localOriginal = lcs.toLocal(original);

  const delta = Point.subtract(lcs.toLocal(point), lcs.toLocal(drag.offset));

  switch (drag.type) {
    case 'resize-e':
      localTarget.get('size').w = localOriginal.size.w + delta.x;
      break;
    case 'resize-w':
      localTarget.get('size').w = localOriginal.size.w - delta.x;
      localTarget.get('pos').x = localOriginal.pos.x + delta.x;
      break;
    case 'resize-n':
      localTarget.get('size').h = localOriginal.size.h - delta.y;
      localTarget.get('pos').y = localOriginal.pos.y + delta.y;
      break;
    case 'resize-s':
      localTarget.get('size').h = localOriginal.size.h + delta.y;
      break;
    case 'resize-nw':
      localTarget.get('size').h = localOriginal.size.h - delta.y;
      localTarget.get('pos').y = localOriginal.pos.y + delta.y;
      localTarget.get('size').w = localOriginal.size.w - delta.x;
      localTarget.get('pos').x = localOriginal.pos.x + delta.x;
      break;
    case 'resize-ne':
      localTarget.get('size').h = localOriginal.size.h - delta.y;
      localTarget.get('pos').y = localOriginal.pos.y + delta.y;
      localTarget.get('size').w = localOriginal.size.w + delta.x;
      break;
    case 'resize-se':
      localTarget.get('size').h = localOriginal.size.h + delta.y;
      localTarget.get('size').w = localOriginal.size.w + delta.x;
      break;
    case 'resize-sw':
      localTarget.get('size').h = localOriginal.size.h + delta.y;
      localTarget.get('size').w = localOriginal.size.w - delta.x;
      localTarget.get('pos').x = localOriginal.pos.x + delta.x;
      break;
  }

  const globalTarget = lcs.toGlobal(localTarget.getSnapshot());
  selection.size = globalTarget.size;
  selection.pos = globalTarget.pos;

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
