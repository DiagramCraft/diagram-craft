import { useEffect, useMemo, useState } from 'react';

/**
 * Local editable copy of server state. Resets whenever `source` changes, and reports
 * whether the draft differs from what the source currently describes.
 * `toDraft` must be referentially stable (a module-level function).
 */
export const useDraft = <S, D>(source: S, toDraft: (source: S) => D) => {
  const initial = useMemo(() => toDraft(source), [source, toDraft]);
  const [draft, setDraft] = useState<D>(initial);

  useEffect(() => setDraft(initial), [initial]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const reset = () => setDraft(initial);

  return { draft, setDraft, initial, dirty, reset };
};
