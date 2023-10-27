import { ResolvedNodeDef } from './diagram.ts';
import { Coord, Extent } from './types.ts';

export type SelectionState = {
  pos: Coord;
  size: Extent;
  elements: ResolvedNodeDef[];
};

export const SelectionState = {
  update: (dest: SelectionState | undefined, elements: ResolvedNodeDef[]) => {
    const d: Partial<SelectionState> = dest || {};
    d.elements = elements;

    const bb = Extent.boundingBox(elements.map(e => ({ pos: e.world, size: e.size })));

    d.pos = bb.pos;
    d.size = bb.size;
    return d as SelectionState;
  },

  set: (dest: SelectionState | undefined, element: ResolvedNodeDef) => {
    return SelectionState.update(dest, [element]);
  },

  recalculate: (state: SelectionState) => {
    return SelectionState.update(state, state.elements);
  },

  toggle: (dest: SelectionState | undefined, element: ResolvedNodeDef) => {
    if (dest?.elements?.includes(element)) {
      return SelectionState.update(
        dest,
        (dest?.elements ?? []).filter(e => e !== element)
      );
    } else {
      return SelectionState.update(dest, [...(dest?.elements ?? []), element]);
    }
  }
};
