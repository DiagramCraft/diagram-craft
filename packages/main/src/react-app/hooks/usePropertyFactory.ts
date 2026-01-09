import { useEffect, useState } from 'react';
import { UndoableAction } from '@diagram-craft/model/undoManager';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { DynamicAccessor, PropPath, PropPathValue } from '@diagram-craft/utils/propertyPath';
import { DeepReadonly } from '@diagram-craft/utils/types';
import { unique, uniqueWithCount } from '@diagram-craft/utils/array';
import { useRedraw } from './useRedraw';
import { Defaults } from '@diagram-craft/model/diagramDefaults';
import type { Property, PropertyInfo } from '@diagram-craft/model/property';
import { isObj } from '@diagram-craft/utils/object';
import { Diagram } from '@diagram-craft/model/diagram';

export type PropertyHook<TBase, TObj> = <
  K extends PropPath<TObj>,
  V extends PropPathValue<TObj, K>,
  DV extends V
>(
  obj: TBase,
  propertyPath: K,
  defaultValue?: DV
) => Property<NonNullable<V>>;

export type PropertyArrayHook<TBase, TObj> = <
  K extends PropPath<TObj>,
  V extends PropPathValue<TObj, K>,
  DV extends V
>(
  obj: TBase,
  propertyPath: K,
  defaultValue?: NonNullable<DV>
) => Property<NonNullable<V>>;

export const makePropertyHook = <
  TBase,
  TObj,
  TPath extends PropPath<TObj> = PropPath<TObj>,
  TValue extends PropPathValue<TObj, TPath> = PropPathValue<TObj, TPath>
>(
  getObj: (obj: TBase) => TObj,
  updateObj: (obj: TBase, path: TPath, cb: (obj: TObj) => void) => void,
  subscribe: (obj: TBase, handler: () => void) => void,
  callbacks?: {
    onAfterSet?: (
      obj: TBase,
      path: TPath,
      oldValue: TValue,
      newValue: TValue,
      message?: string
    ) => void;
  }
): PropertyHook<TBase, TObj> => {
  return ((obj: TBase, path: TPath, defaultValue: TValue) => {
    const [value, setValue] = useState<TValue>(defaultValue);
    const redraw = useRedraw();
    const handler = () => {
      const accessor = new DynamicAccessor<TObj>();
      const value = accessor.get(getObj(obj), path);

      if (value === undefined || value === null) return setValue(defaultValue);
      else return setValue(value as unknown as TValue);
    };
    subscribe(obj, handler);
    // biome-ignore lint/correctness/useExhaustiveDependencies: this is correct
    useEffect(handler, [defaultValue, obj, path]);

    const accessor = new DynamicAccessor<TObj>();
    const isSet = accessor.get(getObj(obj), path) !== undefined;

    return {
      val: value,
      set: (v: TValue, message?: string) => {
        updateObj(obj, path, p => {
          new DynamicAccessor<TObj>().set(p, path, v);
        });
        callbacks?.onAfterSet?.(obj, path, value, v, message);
        setValue(v ?? defaultValue);

        // Need to force redraw, as the current value may be the same as
        // the default value - but the isDefaultVal might result in a different result
        redraw();
      },
      hasMultipleValues: false,
      isSet: isSet
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
  getStoredObj: (e: TItem) => DeepReadonly<TObj>,
  getPropertyInfo: (e: TItem, path: TPath, defaultValue?: TValue) => PropertyInfo<TValue>,
  updateObj: (obj: TBase, e: TItem, cb: (obj: TObj) => void) => void,
  subscribe: (obj: TBase, handler: () => void) => void,
  defaults: Defaults<TObj>,
  callbacks?: {
    onAfterSet?: (
      obj: TBase,
      items: TItem[],
      path: TPath,
      oldValues: TValue[],
      value: TValue,
      message?: string
    ) => void;
  }
): PropertyArrayHook<TBase, TObj> => {
  return ((obj: TBase, path: TPath, defaultValueOverride?: TValue) => {
    const accessor = new DynamicAccessor<TObj>();

    const defaultValue = defaultValueOverride ?? (defaults.get(path) as TValue);
    const defaultValueSerialized = isObj(defaultValue)
      ? JSON.stringify(defaultValue)
      : defaultValue;
    const [value, setValue] = useState<TValue>(defaultValue);
    const [multiple, setMultiple] = useState(false);
    const [values, setValues] = useState<Array<{ val: TValue; count: number }> | undefined>();
    const redraw = useRedraw();
    const handler = () => {
      const accessor = new DynamicAccessor<TObj>();
      const fullArray = getArr(obj).map(obj => accessor.get(getObj(obj) as TObj, path));
      const arr = unique(fullArray);

      if (arr.length === 1) {
        setValue((arr[0]! as TValue) ?? defaultValue);
        setValues([
          {
            val: (arr[0]! as TValue) ?? defaultValue,
            count: getArr(obj).length
          }
        ]);
      } else {
        setValue(defaultValue);
        setValues(uniqueWithCount(fullArray).map(e => ({ val: e.val as TValue, count: e.count })));
      }

      setMultiple(arr.length > 1);
    };
    subscribe(obj, handler);
    // biome-ignore lint/correctness/useExhaustiveDependencies: This is correct
    useEffect(handler, [defaultValueSerialized, obj, path]);

    let isSet = true;
    if (!multiple) {
      const accessor = new DynamicAccessor<TObj>();
      const arr = unique(getArr(obj).map(obj => accessor.get(getStoredObj(obj) as TObj, path)));
      isSet = arr.length === 1 && arr[0] !== undefined;
    }

    return {
      val: value,
      set: (v: TValue, message?: string) => {
        const oldValues = getArr(obj).map(obj => accessor.get(getObj(obj) as TObj, path));
        getArr(obj).forEach(n => {
          updateObj(obj, n, p => {
            accessor.set(p, path, v);
          });
        });
        callbacks?.onAfterSet?.(obj, getArr(obj), path, oldValues as TValue[], v, message);
        setValue(v ?? defaultValue);
        setMultiple(false);

        // Need to force redraw, as the current value may be the same as
        // the default value - but the isDefaultVal might result in a different result
        redraw();
      },
      hasMultipleValues: multiple,
      isSet: isSet,
      info:
        multiple || getArr(obj)[0] === undefined
          ? undefined
          : getPropertyInfo(getArr(obj)[0]!, path, defaultValueOverride),
      values: values
    };
  }) as PropertyArrayHook<TBase, TObj>;
};

// TODO: Potentially add merge support
// TODO: Add better typing
export class PropertyArrayUndoableAction<
  TItem,
  TObj,
  TPath extends PropPath<TObj> = PropPath<TObj>
> implements UndoableAction {
  #accessor = new DynamicAccessor<TObj>();

  constructor(
    public readonly description: string,
    private readonly diagram: Diagram,
    private readonly items: TItem[],
    private readonly path: TPath,
    // biome-ignore lint/suspicious/noExplicitAny: false positive
    private readonly before: any[],
    // biome-ignore lint/suspicious/noExplicitAny: false positive
    private readonly after: any,
    private readonly updateObj: (item: TItem, uow: UnitOfWork, cb: (obj: TObj) => void) => void
  ) {}

  undo(): void {
    UnitOfWork.execute(this.diagram, uow => {
      this.items.forEach((e, idx) => {
        this.updateObj(e, uow, p => {
          this.#accessor.set(p, this.path, this.before[idx]);
        });
      });
    });
  }

  redo(): void {
    UnitOfWork.execute(this.diagram, uow => {
      this.items.forEach(e => {
        this.updateObj(e, uow, p => {
          this.#accessor.set(p, this.path, this.after);
        });
      });
    });
  }
}
