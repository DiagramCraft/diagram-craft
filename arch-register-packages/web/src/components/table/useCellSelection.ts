import { useCallback, useState } from 'react';

// Cells are addressed by row id and column id (not DOM position) so the selection survives
// reordering, hiding columns, sorting and, later, virtualization.
export type CellRef = { rowId: string; columnId: string };

// `focus` is the active cell; the selected range is the rectangle between `anchor` and `focus`
export type CellSelection = { anchor: CellRef; focus: CellRef } | null;

export type CellRange = { r0: number; r1: number; c0: number; c1: number };

export type Direction = 'up' | 'down' | 'left' | 'right' | 'home' | 'end';

// Resolves the selection to index bounds in the current visible row/column order. Returns null when
// there is no selection or either corner is no longer present (e.g. the column was hidden).
export const getSelectedRange = (
  rowIds: string[],
  columnIds: string[],
  selection: CellSelection
): CellRange | null => {
  if (!selection) return null;
  const ar = rowIds.indexOf(selection.anchor.rowId);
  const fr = rowIds.indexOf(selection.focus.rowId);
  const ac = columnIds.indexOf(selection.anchor.columnId);
  const fc = columnIds.indexOf(selection.focus.columnId);
  if (ar < 0 || fr < 0 || ac < 0 || fc < 0) return null;
  return {
    r0: Math.min(ar, fr),
    r1: Math.max(ar, fr),
    c0: Math.min(ac, fc),
    c1: Math.max(ac, fc)
  };
};

export const selectCell = (cell: CellRef): CellSelection => ({ anchor: cell, focus: cell });

// Moves the focus, keeping the anchor when `extend` is set (shift+arrow / shift+click)
export const extendTo = (selection: CellSelection, cell: CellRef): CellSelection =>
  selection ? { anchor: selection.anchor, focus: cell } : selectCell(cell);

export const selectColumns = (
  rowIds: string[],
  fromColumnId: string,
  toColumnId: string = fromColumnId
): CellSelection =>
  rowIds.length === 0
    ? null
    : {
        anchor: { rowId: rowIds[0]!, columnId: fromColumnId },
        focus: { rowId: rowIds[rowIds.length - 1]!, columnId: toColumnId }
      };

export const selectAll = (rowIds: string[], columnIds: string[]): CellSelection =>
  rowIds.length === 0 || columnIds.length === 0
    ? null
    : {
        anchor: { rowId: rowIds[0]!, columnId: columnIds[0]! },
        focus: { rowId: rowIds[rowIds.length - 1]!, columnId: columnIds[columnIds.length - 1]! }
      };

export const moveFocus = (
  rowIds: string[],
  columnIds: string[],
  selection: CellSelection,
  direction: Direction,
  extend: boolean
): CellSelection => {
  if (rowIds.length === 0 || columnIds.length === 0) return selection;
  const fr = selection ? rowIds.indexOf(selection.focus.rowId) : -1;
  const fc = selection ? columnIds.indexOf(selection.focus.columnId) : -1;
  if (fr < 0 || fc < 0) return selectCell({ rowId: rowIds[0]!, columnId: columnIds[0]! });

  const clamp = (v: number, max: number) => Math.max(0, Math.min(max, v));
  let r = fr;
  let c = fc;
  if (direction === 'up') r = clamp(fr - 1, rowIds.length - 1);
  if (direction === 'down') r = clamp(fr + 1, rowIds.length - 1);
  if (direction === 'left') c = clamp(fc - 1, columnIds.length - 1);
  if (direction === 'right') c = clamp(fc + 1, columnIds.length - 1);
  if (direction === 'home') c = 0;
  if (direction === 'end') c = columnIds.length - 1;

  const next = { rowId: rowIds[r]!, columnId: columnIds[c]! };
  return extend ? extendTo(selection, next) : selectCell(next);
};

export type CellState = {
  selected: boolean;
  active: boolean;
  edgeTop: boolean;
  edgeRight: boolean;
  edgeBottom: boolean;
  edgeLeft: boolean;
};

export const getCellState = (
  range: CellRange | null,
  focus: CellRef | null,
  rowIndex: number,
  columnIndex: number,
  rowId: string,
  columnId: string
): CellState => {
  const selected =
    range !== null &&
    rowIndex >= range.r0 &&
    rowIndex <= range.r1 &&
    columnIndex >= range.c0 &&
    columnIndex <= range.c1;
  return {
    selected,
    active: focus?.rowId === rowId && focus?.columnId === columnId,
    edgeTop: selected && rowIndex === range!.r0,
    edgeBottom: selected && rowIndex === range!.r1,
    edgeLeft: selected && columnIndex === range!.c0,
    edgeRight: selected && columnIndex === range!.c1
  };
};

// A column header is "selected" when the range spans every row and includes the column
export const isColumnSelected = (
  range: CellRange | null,
  rowCount: number,
  columnIndex: number
): boolean =>
  range !== null &&
  rowCount > 0 &&
  range.r0 === 0 &&
  range.r1 === rowCount - 1 &&
  columnIndex >= range.c0 &&
  columnIndex <= range.c1;

// Tab-separated text that pastes into spreadsheets. Values containing tabs, newlines or quotes are
// quoted (with embedded quotes doubled), matching what Excel/Sheets expect.
export const serializeTsv = (values: string[][]): string =>
  values
    .map(row => row.map(v => (/[\t\n\r"]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)).join('\t'))
    .join('\n');

type Options = {
  // Controlled value; when provided it wins over internal state
  cellSelection?: CellSelection;
  onCellSelectionChange?: (selection: CellSelection) => void;
};

export const useCellSelection = ({
  cellSelection,
  onCellSelectionChange
}: Options): [CellSelection, (next: CellSelection) => void] => {
  const [internal, setInternal] = useState<CellSelection>(null);
  const value = cellSelection !== undefined ? cellSelection : internal;
  const set = useCallback(
    (next: CellSelection) => {
      setInternal(next);
      onCellSelectionChange?.(next);
    },
    [onCellSelectionChange]
  );
  return [value, set];
};
