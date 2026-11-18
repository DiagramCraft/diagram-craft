import { useRef, useState, type ComponentType, type KeyboardEvent } from 'react';
import styles from './CellEditor.module.css';
import type { EditNav } from './useCellEditing';

export type EditorOption = { value: string; label: string };

// What an editor reports when the user finishes: a parsed value, or a parse error (e.g. "abc" in a
// number editor). Validation of the parsed value against the column's `validate` happens outside.
export type EditResult<V = unknown> = { value: V } | { error: string };

export type CellEditorProps<V = unknown> = {
  // Committed value of the cell
  value: V;
  // Set when editing started by typing a character; replaces the current content
  seed?: string;
  options?: EditorOption[];
  // Validation error from the last commit attempt
  error?: string | null;
  onCommit: (result: EditResult<V>, nav: EditNav) => void;
  onCancel: () => void;
};

export type CellEditor<V = unknown> = {
  Editor: ComponentType<CellEditorProps<V>>;
};

const nav = (ev: KeyboardEvent): EditNav =>
  ev.key === 'Enter' ? (ev.shiftKey ? 'up' : 'down') : ev.shiftKey ? 'left' : 'right';

// Shared by the text-like editors: a bare <input> holding a string draft that is parsed on commit.
// Enter/Tab commit and move, Escape cancels, blur commits.
const createInputEditor = <V,>(config: {
  type?: string;
  inputMode?: 'decimal';
  format: (value: V) => string;
  parse: (raw: string) => EditResult<V>;
}): CellEditor<V> => ({
  Editor: ({ value, seed, error, onCommit, onCancel }) => {
    const [draft, setDraft] = useState(seed ?? config.format(value));
    const ref = useRef<HTMLInputElement>(null);
    return (
      <input
        ref={ref}
        autoFocus
        className={styles.input}
        type={config.type ?? 'text'}
        inputMode={config.inputMode}
        value={draft}
        aria-invalid={error ? true : undefined}
        title={error ?? undefined}
        onChange={ev => setDraft(ev.target.value)}
        onFocus={ev => {
          // Seeded edits continue after the typed character; others place the caret at the end
          const end = ev.target.value.length;
          ev.target.setSelectionRange(end, end);
        }}
        onBlur={() => onCommit(config.parse(draft), 'blur')}
        onKeyDown={ev => {
          if (ev.key === 'Enter' || ev.key === 'Tab') {
            ev.preventDefault();
            onCommit(config.parse(draft), nav(ev));
          } else if (ev.key === 'Escape') {
            ev.preventDefault();
            ev.stopPropagation();
            onCancel();
          }
        }}
      />
    );
  }
});

const text = createInputEditor<string | null>({
  format: v => v ?? '',
  parse: raw => ({ value: raw })
});

const number = createInputEditor<number | null>({
  inputMode: 'decimal',
  format: v => (v === null || v === undefined ? '' : String(v)),
  parse: raw => {
    const trimmed = raw.trim();
    if (trimmed === '') return { value: null };
    const n = Number(trimmed);
    return Number.isFinite(n) ? { value: n } : { error: 'Not a number' };
  }
});

const date = createInputEditor<string | null>({
  type: 'date',
  format: v => v ?? '',
  parse: raw => ({ value: raw === '' ? null : raw })
});

// Commits on selection, like picking from a dropdown in a spreadsheet
const select: CellEditor<string | null> = {
  Editor: ({ value, options = [], onCommit, onCancel }) => (
    <select
      autoFocus
      className={styles.input}
      value={value ?? ''}
      onChange={ev => onCommit({ value: ev.target.value === '' ? null : ev.target.value }, 'none')}
      onBlur={() => onCancel()}
      onKeyDown={ev => {
        if (ev.key === 'Escape') {
          ev.preventDefault();
          ev.stopPropagation();
          onCancel();
        } else if (ev.key === 'Tab') {
          ev.preventDefault();
          onCommit({ value: value ?? null }, nav(ev));
        }
      }}
    >
      <option value="" />
      {options.map(o => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
};

const boolean: CellEditor<boolean | null> = {
  Editor: ({ value, onCommit, onCancel }) => (
    <input
      autoFocus
      type="checkbox"
      className={styles.checkbox}
      checked={value === true}
      onChange={ev => onCommit({ value: ev.target.checked }, 'none')}
      onBlur={() => onCancel()}
      onKeyDown={ev => {
        if (ev.key === 'Escape') {
          ev.preventDefault();
          ev.stopPropagation();
          onCancel();
        } else if (ev.key === 'Enter' || ev.key === 'Tab') {
          ev.preventDefault();
          onCommit({ value: value === true }, nav(ev));
        }
      }}
    />
  )
};

// Add editors for new cell types with `registerCellEditor`, or pass a CellEditor object directly as
// a column's `meta.editor`.
// biome-ignore lint/suspicious/noExplicitAny: the registry holds editors for different value types
const registry: Record<string, CellEditor<any>> = { text, number, date, select, boolean };

// biome-ignore lint/suspicious/noExplicitAny: see registry
export const registerCellEditor = (type: string, editor: CellEditor<any>) => {
  registry[type] = editor;
};

export const resolveCellEditor = (
  editor: string | CellEditor | undefined
): CellEditor | undefined => (typeof editor === 'string' ? registry[editor] : editor);
