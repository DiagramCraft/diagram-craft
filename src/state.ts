import { ResolvedNodeDef } from './diagram.ts';
import { Coord, Extent, Box } from './geometry.ts';

export type Drag = {
  type:
    | 'move'
    | 'resize-nw'
    | 'resize-ne'
    | 'resize-sw'
    | 'resize-se'
    | 'resize-n'
    | 'resize-s'
    | 'resize-w'
    | 'resize-e'
    | 'rotate';
  offset: Coord;
  original: Box;
};

export type SelectionState = {
  pos: Coord;
  size: Extent;
  rotation?: number;
  elements: ResolvedNodeDef[];
};

export const SelectionState = {
  update: (dest: SelectionState | undefined, elements: ResolvedNodeDef[]) => {
    const d: Partial<SelectionState> = dest ?? {};
    d.elements = elements;

    const bb = d.elements.length === 0 ? SelectionState.EMPTY() : Box.boundingBox(elements);

    d.pos = bb.pos;
    d.size = bb.size;
    d.rotation = d.rotation ?? bb.rotation ?? 0;
    return d as SelectionState;
  },

  set: (dest: SelectionState | undefined, element: ResolvedNodeDef) => {
    if (dest) dest.rotation = undefined;
    return SelectionState.update(dest, [element]);
  },

  recalculate: (state: SelectionState) => {
    return SelectionState.update(state, state.elements);
  },

  toggle: (dest: SelectionState | undefined, element: ResolvedNodeDef) => {
    if (dest) dest.rotation = undefined;
    if (dest?.elements?.includes(element)) {
      return SelectionState.update(
        dest,
        (dest?.elements ?? []).filter(e => e !== element)
      );
    } else {
      return SelectionState.update(dest, [...(dest?.elements ?? []), element]);
    }
  },

  clear: (dest: SelectionState) => {
    if (dest) dest.rotation = undefined;
    return SelectionState.update(dest, []);
  },

  EMPTY: () => ({
    pos: { x: Number.MIN_SAFE_INTEGER, y: Number.MIN_SAFE_INTEGER },
    size: { w: 0, h: 0 },
    rotation: undefined,
    elements: []
  }),

  isEmpty(selection: SelectionState) {
    return (
      selection.size.w === 0 &&
      selection.size.h === 0 &&
      selection.pos.x === SelectionState.EMPTY().pos.x &&
      selection.pos.y === SelectionState.EMPTY().pos.y
    );
  }
};
