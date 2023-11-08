import { SelectionState } from './selectionState.ts';
import { expect, test, describe } from 'vitest';
import { ResolvedNodeDef } from './diagram.ts';

describe('SelectionState', () => {
  test('empty selection has zero size', () => {
    expect(new SelectionState().isEmpty()).toBe(true);
    expect(new SelectionState().bounds.size.w).toBe(0);
    expect(new SelectionState().bounds.size.h).toBe(0);
  });

  test('toggle twice clears selection', () => {
    const element: ResolvedNodeDef = {
      id: '1',
      type: 'node',
      bounds: {
        pos: { x: 0, y: 0 },
        size: { w: 10, h: 10 },
        rotation: 0
      },
      children: [],
      nodeType: 'test'
    };

    const s = new SelectionState();

    s.toggle(element);
    expect(s.isEmpty()).toBe(false);
    expect(s.bounds.size.w).toBe(10);
    expect(s.bounds.size.h).toBe(10);

    s.toggle(element);
    expect(s.isEmpty()).toBe(true);
    expect(s.bounds.size.w).toBe(0);
    expect(s.bounds.size.h).toBe(0);
  });
});
