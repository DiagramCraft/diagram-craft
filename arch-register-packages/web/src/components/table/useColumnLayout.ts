import { useCallback, useState } from 'react';
import type { ColumnOrderState, ColumnVisibilityState } from '@tanstack/react-table';
import { usePersistedViewConfig } from '../../hooks/usePersistedViewConfig';

export type ColumnLayout = {
  visibility: ColumnVisibilityState;
  order: ColumnOrderState;
};

type Options = {
  // Controlled values; when provided they win over internal/persisted state
  columnVisibility?: ColumnVisibilityState;
  columnOrder?: ColumnOrderState;
  onColumnVisibilityChange?: (visibility: ColumnVisibilityState) => void;
  onColumnOrderChange?: (order: ColumnOrderState) => void;
  // localStorage key prefix; the layout is stored under `${persistKey}:columns`
  persistKey?: string;
};

const EMPTY: ColumnLayout = { visibility: {}, order: [] };

// Moves `id` by `delta` positions within `order`, clamped to the list bounds
export const moveColumn = (order: string[], id: string, delta: number): string[] => {
  const from = order.indexOf(id);
  if (from < 0) return order;
  const to = Math.max(0, Math.min(order.length - 1, from + delta));
  if (to === from) return order;
  const next = [...order];
  next.splice(from, 1);
  next.splice(to, 0, id);
  return next;
};

// Resolves the effective column visibility and order for DataTable:
// controlled > persisted (localStorage) > internal.
export const useColumnLayout = ({
  columnVisibility,
  columnOrder,
  onColumnVisibilityChange,
  onColumnOrderChange,
  persistKey
}: Options) => {
  const [internal, setInternal] = useState<ColumnLayout>(EMPTY);
  const [persisted, setPersisted] = usePersistedViewConfig<ColumnLayout>({
    storageKey: persistKey ? `${persistKey}:columns` : '',
    externalConfig: null
  });

  const base = (persistKey ? persisted : null) ?? internal;
  const layout: ColumnLayout = {
    visibility: columnVisibility ?? base.visibility,
    order: columnOrder ?? base.order
  };

  const update = useCallback(
    (next: ColumnLayout, changed: 'visibility' | 'order' | 'both') => {
      setInternal(next);
      if (persistKey) setPersisted(next);
      if (changed !== 'order') onColumnVisibilityChange?.(next.visibility);
      if (changed !== 'visibility') onColumnOrderChange?.(next.order);
    },
    [onColumnOrderChange, onColumnVisibilityChange, persistKey, setPersisted]
  );

  return [layout, update] as const;
};
