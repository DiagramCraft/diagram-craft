import { useRef } from 'react';
import { moveItem, reconcileKeys, removeAt, replaceAt, updateAt } from './listEditorOps';

let nextKey = 0;
const makeKey = () => `list-item-${nextKey++}`;

export type ListEditorApi<T> = {
  /** Stable key per item, aligned with `items` */
  keys: string[];
  append: (item: T) => void;
  update: (index: number, patch: Partial<T>) => void;
  replace: (index: number, item: T) => void;
  remove: (index: number) => void;
  move: (fromIndex: number, toIndex: number) => void;
};

/**
 * Stable per-row keys for a list.
 *
 * When `getId` is given it is the key. Otherwise keys are tracked internally, so rows keep their
 * identity (and input focus) even when the item has no id, or its id is itself editable.
 * Callers that change the list must keep the keys aligned via the returned `setKeys`.
 */
export const useRowKeys = <T>(items: T[], getId?: (item: T) => string) => {
  const keysRef = useRef<string[]>([]);
  if (!getId) keysRef.current = reconcileKeys(keysRef.current, items.length, makeKey);
  return {
    keys: getId ? items.map(getId) : keysRef.current,
    tracked: !getId,
    setKeys: (keys: string[]) => {
      keysRef.current = keys;
    },
    current: () => keysRef.current
  };
};

/**
 * Array editing operations for a controlled list, plus stable per-row keys.
 */
export const useListEditor = <T>(
  items: T[],
  onChange: (items: T[]) => void,
  getId?: (item: T) => string
): ListEditorApi<T> => {
  const rows = useRowKeys(items, getId);

  return {
    keys: rows.keys,
    append: item => {
      if (rows.tracked) rows.setKeys([...rows.current(), makeKey()]);
      onChange([...items, item]);
    },
    update: (index, patch) => onChange(updateAt(items, index, patch)),
    replace: (index, item) => onChange(replaceAt(items, index, item)),
    remove: index => {
      if (rows.tracked) rows.setKeys(removeAt(rows.current(), index));
      onChange(removeAt(items, index));
    },
    move: (fromIndex, toIndex) => {
      if (rows.tracked) rows.setKeys(moveItem(rows.current(), fromIndex, toIndex));
      onChange(moveItem(items, fromIndex, toIndex));
    }
  };
};
