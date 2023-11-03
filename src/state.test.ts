import { SelectionState } from './state.ts';
import { expect, test, describe } from 'vitest';

describe('SelectionState', () => {
  test('empty selection has zero size', () => {
    expect(SelectionState.isEmpty(SelectionState.EMPTY())).toBe(true);
    expect(SelectionState.EMPTY().size.w).toBe(0);
    expect(SelectionState.EMPTY().size.h).toBe(0);
  });

  test('update with empty elements is empty', () => {
    const s = SelectionState.EMPTY();
    SelectionState.toggle(s, {
      id: '1',
      type: 'node',
      pos: { x: 0, y: 0 },
      size: { w: 10, h: 10 },
      children: [],
      nodeType: 'test'
    });
    expect(SelectionState.isEmpty(s)).toBe(false);
    SelectionState.update(s, []);
    expect(SelectionState.isEmpty(s)).toBe(true);
  });
});
