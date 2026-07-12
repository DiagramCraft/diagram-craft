import { useMemo, useState } from 'react';

export type SortDir = 'asc' | 'desc';
export type SortState<K extends string = string> = { key: K; dir: SortDir };

export const nextSortState = <K extends string>(
  prev: SortState<K> | null,
  key: K
): SortState<K> => {
  if (prev?.key === key) {
    return { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' };
  }
  return { key, dir: 'asc' };
};

export const sortRows = <T, K extends string>(
  rows: readonly T[],
  sort: SortState<K> | null,
  comparators: Record<K, (a: T, b: T) => number>
): T[] => {
  if (!sort) return [...rows];
  const comparator = comparators[sort.key];
  const sorted = [...rows].sort(comparator);
  return sort.dir === 'desc' ? sorted.reverse() : sorted;
};

export const useTableSort = <T, K extends string>(
  rows: readonly T[],
  comparators: Record<K, (a: T, b: T) => number>,
  initial?: SortState<K>
): { sorted: T[]; sort: SortState<K> | null; toggleSort: (key: K) => void } => {
  const [sort, setSort] = useState<SortState<K> | null>(initial ?? null);

  const sorted = useMemo(() => sortRows(rows, sort, comparators), [rows, sort, comparators]);

  const toggleSort = (key: K) => setSort(prev => nextSortState(prev, key));

  return { sorted, sort, toggleSort };
};
