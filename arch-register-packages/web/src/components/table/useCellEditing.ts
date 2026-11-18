import { useCallback, useState } from 'react';
import type { z } from 'zod';
import type { CellEditor, EditorOption } from './cellEditors';
import type { CellRef, Direction } from './useCellSelection';

// The cell being edited; `seed` is set when editing was started by typing a character (spreadsheet
// behaviour: the typed character replaces the cell's content instead of appending to it)
export type EditingState = { cell: CellRef; seed?: string } | null;

// How an edit ended. 'blur' commits but does not move; the rest move the selection like Excel/Sheets.
export type EditNav = 'down' | 'up' | 'right' | 'left' | 'none' | 'blur';

// Per-column editing options, read from `columnDef.meta`
export type CellEditingMeta = {
  // Registry key (see cellEditors) or a custom editor definition
  editor?: string | CellEditor;
  // Set to false, or return false for a row, to make cells read-only
  // biome-ignore lint/suspicious/noExplicitAny: column meta is not generic over the row type
  editable?: boolean | ((row: any) => boolean);
  // Choices for the `select` editor
  options?: EditorOption[];
  // Returns an error message (or null/undefined when valid), or a zod schema applied to the parsed value
  validate?: ((value: unknown) => string | null | undefined) | z.ZodType;
};

export const navToDirection = (nav: EditNav): Direction | null =>
  nav === 'down' || nav === 'up' || nav === 'right' || nav === 'left' ? nav : null;

export const isCellEditable = (meta: CellEditingMeta | undefined, row: unknown): boolean => {
  if (!meta?.editor) return false;
  if (typeof meta.editable === 'function') return meta.editable(row);
  return meta.editable !== false;
};

export const validateValue = (
  validate: CellEditingMeta['validate'],
  value: unknown
): string | null => {
  if (!validate) return null;
  if (typeof validate === 'function') return validate(value) ?? null;
  const result = validate.safeParse(value);
  return result.success ? null : (result.error.issues[0]?.message ?? 'Invalid value');
};

export type EditStart = { seed?: string } | null;

// Which key presses start editing from the table (not from inside an editor). Returns null for keys
// that don't start an edit.
export const getEditStart = (ev: {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
}): EditStart => {
  if (ev.key === 'Enter' || ev.key === 'F2') return {};
  if (ev.key.length === 1 && !ev.ctrlKey && !ev.metaKey && !ev.altKey) return { seed: ev.key };
  return null;
};

type Options = {
  // Controlled value; when provided it wins over internal state
  editingCell?: EditingState;
  onEditingChange?: (editing: EditingState) => void;
};

export const useCellEditing = ({
  editingCell,
  onEditingChange
}: Options): [EditingState, (next: EditingState) => void] => {
  const [internal, setInternal] = useState<EditingState>(null);
  const value = editingCell !== undefined ? editingCell : internal;
  const set = useCallback(
    (next: EditingState) => {
      setInternal(next);
      onEditingChange?.(next);
    },
    [onEditingChange]
  );
  return [value, set];
};
