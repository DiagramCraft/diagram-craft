import { DynamicAccessor, PropPath, PropPathValue } from '../../utils/propertyPath.ts';
import { useEffect, useState } from 'react';
import { unique } from '../../utils/array.ts';
import { UndoableAction } from '../../model/undoManager.ts';

/* eslint-disable @typescript-eslint/no-explicit-any */

export type PropertyHook<TBase, TObj> = <
  K extends PropPath<TObj>,
  V extends PropPathValue<TObj, K>,
  DV extends V
>(
  obj: TBase,
  propertyPath: K,
  defaultValue: DV
) => {
  val: V;
  set: (value: V) => void;
};

export type PropertyArrayHook<TBase, TObj> = <
  K extends PropPath<TObj>,
  V extends PropPathValue<TObj, K>,
  DV extends V
>(
  obj: TBase,
  propertyPath: K,
  defaultValue: NonNullable<DV>
) => {
  val: NonNullable<V>;
  set: (value: V) => void;
  hasMultipleValues: boolean;
};

export const makePropertyHook = <
  TBase,
  TObj,
  TPath extends PropPath<TObj> = PropPath<TObj>,
  TValue extends PropPathValue<TObj, TPath> = PropPathValue<TObj, TPath>
>(
  getObj: (obj: TBase) => TObj,
  subscribe: (obj: TBase, handler: () => void) => void,
  commit: (obj: TBase) => void = () => {},
  callbacks?: {
    onAfterSet?: (obj: TBase, path: TPath, oldValue: TValue, newValue: TValue) => void;
  }
): PropertyHook<TBase, TObj> => {
  return ((obj: TBase, path: TPath, defaultValue: TValue) => {
    const [value, setValue] = useState<TValue>(defaultValue);
    const handler = () => {
      const accessor = new DynamicAccessor<TObj>();
      const value = accessor.get(getObj(obj), path);

      if (value === undefined || value === null) return setValue(defaultValue);
      else return setValue(value as unknown as TValue);
    };
    subscribe(obj, handler);
    useEffect(handler, [defaultValue, obj, path]);

    return {
      val: value,
      set: (v: TValue) => {
        new DynamicAccessor<TObj>().set(getObj(obj), path, v);
        callbacks?.onAfterSet?.(obj, path, value, v);
        commit(obj);
        setValue(v);
      }
    };
  }) as PropertyHook<TBase, TObj>;
};

export const makePropertyArrayHook = <
  TBase,
  TItem,
  TObj,
  TPath extends PropPath<TObj> = PropPath<TObj>,
  TValue extends PropPathValue<TObj, TPath> = PropPathValue<TObj, TPath>
>(
  getArr: (obj: TBase) => TItem[],
  getObj: (e: TItem) => TObj,
  subscribe: (obj: TBase, handler: () => void) => void,
  commit: (obj: TBase, item: TItem) => void,
  callbacks?: {
    onAfterSet?: (
      obj: TBase,
      items: TItem[],
      path: TPath,
      oldValues: TValue[],
      value: TValue
    ) => void;
  }
): PropertyArrayHook<TBase, TObj> => {
  return ((obj: TBase, path: TPath, defaultValue: TValue) => {
    const [value, setValue] = useState<TValue>(defaultValue);
    const [multiple, setMultiple] = useState(false);
    const handler = () => {
      const accessor = new DynamicAccessor<TObj>();
      const arr = unique(getArr(obj).map(obj => accessor.get(getObj(obj), path)));

      if (arr.length === 1) setValue((arr[0]! as TValue) ?? defaultValue);
      else setValue(defaultValue);

      setMultiple(arr.length > 1);
    };
    subscribe(obj, handler);
    useEffect(handler, [defaultValue, obj, path]);

    const accessor = new DynamicAccessor<TObj>();
    return {
      val: value,
      set: (v: TValue) => {
        const oldValues = getArr(obj).map(obj => accessor.get(getObj(obj), path));
        getArr(obj).forEach(n => {
          accessor.set(getObj(n), path, v);
          commit(obj, n);
        });
        callbacks?.onAfterSet?.(obj, getArr(obj), path, oldValues as TValue[], v);
        setValue(v);
        setMultiple(false);
      },
      hasMultipleValues: multiple
    };
  }) as PropertyArrayHook<TBase, TObj>;
};

// TODO: Potentially add merge support
// TODO: Add better typing
export class PropertyArrayUndoableAction<T> implements UndoableAction {
  #accessor = new DynamicAccessor<T>();

  constructor(
    private readonly items: any[],
    private readonly path: any,
    private readonly before: any[],
    private readonly after: any,
    public readonly description: string,
    private readonly getObj: (item: T) => any,
    private readonly commit: (obj: T) => void
  ) {}

  undo(): void {
    this.items.forEach((e, idx) => {
      this.#accessor.set(this.getObj(e), this.path, this.before[idx]);
      this.commit(e);
    });
  }

  redo(): void {
    this.items.forEach(e => {
      this.#accessor.set(this.getObj(e), this.path, this.after);
      this.commit(e);
    });
  }
}

// TODO: Potentially add merge support
// TODO: Add better typing
export class PropertyUndoableAction<T> implements UndoableAction {
  #accessor = new DynamicAccessor<T>();

  constructor(
    private readonly obj: any,
    private readonly path: any,
    private readonly before: any,
    private readonly after: any,
    public readonly description: string,
    private readonly commit: (obj: T) => void
  ) {}

  undo(): void {
    this.#accessor.set(this.obj, this.path, this.before);
    this.commit(this.obj);
  }

  redo(): void {
    this.#accessor.set(this.obj, this.path, this.after);
    this.commit(this.obj);
  }
}
