import { useCallback, useState } from 'react';
import type { ColumnSizingState } from '@tanstack/react-table';
import { usePersistedViewConfig } from '../../hooks/usePersistedViewConfig';

type Options = {
  // Controlled sizing; when provided it wins over internal/persisted state
  columnSizing?: ColumnSizingState;
  onColumnSizingChange?: (sizing: ColumnSizingState) => void;
  // localStorage key; widths are loaded from and saved to it
  persistKey?: string;
};

// Resolves the effective column sizing for DataTable: controlled > persisted (localStorage) > internal.
export const useColumnSizing = ({ columnSizing, onColumnSizingChange, persistKey }: Options) => {
  const [internal, setInternal] = useState<ColumnSizingState>({});
  const [persisted, setPersisted] = usePersistedViewConfig<ColumnSizingState>({
    storageKey: persistKey ?? '',
    externalConfig: null
  });

  const sizing = columnSizing ?? (persistKey ? persisted : null) ?? internal;

  const setSizing = useCallback(
    (next: ColumnSizingState) => {
      setInternal(next);
      if (persistKey) setPersisted(next);
      onColumnSizingChange?.(next);
    },
    [onColumnSizingChange, persistKey, setPersisted]
  );

  return [sizing, setSizing] as const;
};
