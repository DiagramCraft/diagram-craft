import { useRef, useState } from 'react';
import { resolveCellEditor, type EditResult } from './cellEditors';
import { validateValue, type CellEditingMeta, type EditNav } from './useCellEditing';

type Props = {
  meta: CellEditingMeta;
  value: unknown;
  seed?: string;
  // Called once with the validated value, or with undefined when the edit was cancelled
  onDone: (result: { value: unknown } | undefined, nav: EditNav) => void;
};

// Hosts the editor for one cell: owns validation and makes sure the edit ends exactly once.
// An invalid Enter/Tab commit keeps the editor open with an error; an invalid blur reverts.
export const EditableCell = ({ meta, value, seed, onDone }: Props) => {
  const [error, setError] = useState<string | null>(null);
  const done = useRef(false);
  const editor = resolveCellEditor(meta.editor);
  if (!editor) return null;

  const finish = (result: { value: unknown } | undefined, nav: EditNav) => {
    if (done.current) return;
    done.current = true;
    onDone(result, nav);
  };

  const commit = (result: EditResult, nav: EditNav) => {
    const err = 'error' in result ? result.error : validateValue(meta.validate, result.value);
    if (err === null) return finish({ value: (result as { value: unknown }).value }, nav);
    if (nav === 'blur') return finish(undefined, nav);
    setError(err);
  };

  return (
    <editor.Editor
      value={value}
      seed={seed}
      options={meta.options}
      error={error}
      onCommit={commit}
      onCancel={() => finish(undefined, 'none')}
    />
  );
};
