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
 * Array editing operations for a controlled list, plus stable per-row keys.
 *
 * When `getId` is given it is the key. Otherwise keys are tracked internally across
 * append/remove/move, so rows keep their identity (and input focus) even when the item has
 * no id, or its id is itself editable.
 */
export const useListEditor = <T>(
  items: T[],
  onChange: (items: T[]) => void,
  getId?: (item: T) => string
): ListEditorApi<T> => {
  const keysRef = useRef<string[]>([]);

  if (!getId) keysRef.current = reconcileKeys(keysRef.current, items.length, makeKey);
  const keys = getId ? items.map(getId) : keysRef.current;

  return {
    keys,
    append: item => {
      if (!getId) keysRef.current = [...keysRef.current, makeKey()];
      onChange([...items, item]);
    },
    update: (index, patch) => onChange(updateAt(items, index, patch)),
    replace: (index, item) => onChange(replaceAt(items, index, item)),
    remove: index => {
      if (!getId) keysRef.current = removeAt(keysRef.current, index);
      onChange(removeAt(items, index));
    },
    move: (fromIndex, toIndex) => {
      if (!getId) keysRef.current = moveItem(keysRef.current, fromIndex, toIndex);
      onChange(moveItem(items, fromIndex, toIndex));
    }
  };
};
