import { DynamicAccessor, PropPath, PropPathValue } from '@diagram-craft/utils';
import { useEffect, useState } from 'react';
import { UndoableAction } from '@diagram-craft/model';
import { UnitOfWork } from '@diagram-craft/model';
import { DeepReadonly } from '@diagram-craft/utils';
import { unique } from '@diagram-craft/utils';

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
  updateObj: (obj: TBase, cb: (obj: TObj) => void) => void,
  subscribe: (obj: TBase, handler: () => void) => void,
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
        updateObj(obj, p => {
          new DynamicAccessor<TObj>().set(p, path, v);
        });
        callbacks?.onAfterSet?.(obj, path, value, v);
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
  getObj: (e: TItem) => DeepReadonly<TObj>,
  updateObj: (obj: TBase, e: TItem, cb: (obj: TObj) => void) => void,
  subscribe: (obj: TBase, handler: () => void) => void,
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
      const arr = unique(getArr(obj).map(obj => accessor.get(getObj(obj) as TObj, path)));

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
        const oldValues = getArr(obj).map(obj => accessor.get(getObj(obj) as TObj, path));
        getArr(obj).forEach(n => {
          updateObj(obj, n, p => {
            accessor.set(p, path, v);
          });
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
export class PropertyArrayUndoableAction<TItem, TObj, TPath extends PropPath<TObj> = PropPath<TObj>>
  implements UndoableAction
{
  #accessor = new DynamicAccessor<TObj>();

  constructor(
    public readonly description: string,
    private readonly items: TItem[],
    private readonly path: TPath,
    private readonly before: any[],
    private readonly after: any,

    // TODO: Where is this uowFactory coming from
    private readonly uowFactory: () => UnitOfWork,
    private readonly updateObj: (item: TItem, uow: UnitOfWork, cb: (obj: TObj) => void) => void
  ) {}

  undo(): void {
    this.items.forEach((e, idx) => {
      const uow = this.uowFactory();
      this.updateObj(e, uow, p => {
        this.#accessor.set(p, this.path, this.before[idx]);
      });
      uow.commit();
    });
  }

  redo(): void {
    this.items.forEach(e => {
      const uow = this.uowFactory();
      this.updateObj(e, uow, p => {
        this.#accessor.set(p, this.path, this.after);
      });
      uow.commit();
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
