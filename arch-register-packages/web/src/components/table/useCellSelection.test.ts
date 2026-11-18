import { describe, expect, test } from 'vitest';
import {
  extendTo,
  getCellState,
  getSelectedRange,
  isColumnSelected,
  moveFocus,
  selectAll,
  selectCell,
  selectColumns,
  serializeTsv
} from './useCellSelection';

const ROWS = ['r1', 'r2', 'r3'];
const COLS = ['a', 'b', 'c'];

describe('getSelectedRange', () => {
  test('is null without a selection', () => {
    expect(getSelectedRange(ROWS, COLS, null)).toBeNull();
  });

  test('normalizes a backwards range', () => {
    const sel = {
      anchor: { rowId: 'r3', columnId: 'c' },
      focus: { rowId: 'r2', columnId: 'b' }
    };
    expect(getSelectedRange(ROWS, COLS, sel)).toEqual({ r0: 1, r1: 2, c0: 1, c1: 2 });
  });

  test('is null when a corner column is no longer visible', () => {
    expect(
      getSelectedRange(ROWS, ['a', 'c'], selectCell({ rowId: 'r1', columnId: 'b' }))
    ).toBeNull();
  });
});

describe('moveFocus', () => {
  const start = selectCell({ rowId: 'r2', columnId: 'b' });

  test('moves and clamps at the edges', () => {
    expect(moveFocus(ROWS, COLS, start, 'up', false)?.focus).toEqual({
      rowId: 'r1',
      columnId: 'b'
    });
    const top = moveFocus(ROWS, COLS, selectCell({ rowId: 'r1', columnId: 'a' }), 'up', false);
    expect(top?.focus).toEqual({ rowId: 'r1', columnId: 'a' });
  });

  test('extends while keeping the anchor', () => {
    const next = moveFocus(ROWS, COLS, start, 'right', true);
    expect(next?.anchor).toEqual({ rowId: 'r2', columnId: 'b' });
    expect(next?.focus).toEqual({ rowId: 'r2', columnId: 'c' });
  });

  test('home/end jump within the row', () => {
    expect(moveFocus(ROWS, COLS, start, 'home', false)?.focus.columnId).toBe('a');
    expect(moveFocus(ROWS, COLS, start, 'end', false)?.focus.columnId).toBe('c');
  });

  test('starts at the first cell when nothing is selected', () => {
    expect(moveFocus(ROWS, COLS, null, 'down', false)?.focus).toEqual({
      rowId: 'r1',
      columnId: 'a'
    });
  });
});

describe('selection constructors', () => {
  test('selectColumns spans every row', () => {
    const range = getSelectedRange(ROWS, COLS, selectColumns(ROWS, 'a', 'b'));
    expect(range).toEqual({ r0: 0, r1: 2, c0: 0, c1: 1 });
    expect(isColumnSelected(range, ROWS.length, 1)).toBe(true);
    expect(isColumnSelected(range, ROWS.length, 2)).toBe(false);
  });

  test('selectAll covers the whole grid and handles empty input', () => {
    expect(getSelectedRange(ROWS, COLS, selectAll(ROWS, COLS))).toEqual({
      r0: 0,
      r1: 2,
      c0: 0,
      c1: 2
    });
    expect(selectAll([], COLS)).toBeNull();
    expect(selectColumns([], 'a')).toBeNull();
  });

  test('extendTo falls back to a single cell', () => {
    const cell = { rowId: 'r1', columnId: 'a' };
    expect(extendTo(null, cell)).toEqual(selectCell(cell));
  });
});

describe('getCellState', () => {
  const range = { r0: 0, r1: 1, c0: 0, c1: 1 };
  const focus = { rowId: 'r1', columnId: 'a' };

  test('flags edges and the active cell', () => {
    const corner = getCellState(range, focus, 0, 0, 'r1', 'a');
    expect(corner).toMatchObject({
      selected: true,
      active: true,
      edgeTop: true,
      edgeLeft: true,
      edgeBottom: false,
      edgeRight: false
    });
    expect(getCellState(range, focus, 1, 1, 'r2', 'b')).toMatchObject({
      edgeBottom: true,
      edgeRight: true,
      active: false
    });
  });

  test('is unselected outside the range', () => {
    expect(getCellState(range, focus, 2, 0, 'r3', 'a').selected).toBe(false);
  });
});

describe('serializeTsv', () => {
  test('joins cells with tabs and rows with newlines', () => {
    expect(
      serializeTsv([
        ['a', 'b'],
        ['c', 'd']
      ])
    ).toBe('a\tb\nc\td');
  });

  test('quotes values containing tabs, newlines or quotes', () => {
    expect(serializeTsv([['a\tb', 'say "hi"', 'x\ny']])).toBe('"a\tb"\t"say ""hi"""\t"x\ny"');
  });
});
