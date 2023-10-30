import { SelectionState } from './state.ts';
import { expect, test, describe } from 'vitest';

describe('SelectionState', () => {
  test('empty selection has zero size', () => {
    expect(SelectionState.isEmpty(SelectionState.EMPTY())).toBe(true);
    expect(SelectionState.EMPTY().size.w).toBe(0);
    expect(SelectionState.EMPTY().size.h).toBe(0);
  });

  test('update with empty elements is empty', () => {
    expect(SelectionState.isEmpty(SelectionState.update(undefined, []))).toBe(true);
  });
});
