import { useEffect, useState } from 'react';
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
  TObj,
  TPath extends PropPath<TObj> = PropPath<TObj>,
  TValue extends PropPathValue<TObj, TPath> = PropPathValue<TObj, TPath>
>(
  message: (path: TPath) => string,
  getObj: (d: Diagram) => TObj,
  updateObj: (d: Diagram, uow: UnitOfWork, cb: (obj: TObj) => void) => void,
  subscribe: (d: Diagram, handler: () => void) => void
): PropertyHook<Diagram, TObj> => {
  return ((diagram: Diagram, path: TPath, defaultValue: TValue) => {
    const [value, setValue] = useState<TValue>(defaultValue);
    const redraw = useRedraw();
    const handler = () => {
      const accessor = new DynamicAccessor<TObj>();
      const value = accessor.get(getObj(diagram), path);

      if (value === undefined || value === null) return setValue(defaultValue);
      else return setValue(value as unknown as TValue);
    };
    subscribe(diagram, handler);
    // biome-ignore lint/correctness/useExhaustiveDependencies: this is correct
    useEffect(handler, [defaultValue, diagram, path]);

    const accessor = new DynamicAccessor<TObj>();
    const isSet = accessor.get(getObj(diagram), path) !== undefined;

    return {
      val: value,
      set: (v: TValue) => {
        UnitOfWork.executeWithUndo(diagram, message(path), uow => {
          updateObj(diagram, uow, p => {
            new DynamicAccessor<TObj>().set(p, path, v);
          });
        });
        setValue(v ?? defaultValue);

        // Need to force redraw, as the current value may be the same as
        // the default value - but the isDefaultVal might result in a different result
        redraw();
      },
      hasMultipleValues: false,
      isSet: isSet
    };
  }) as PropertyHook<Diagram, TObj>;
};

export const makePropertyArrayHook = <
  TItem,
  TObj,
  TPath extends PropPath<TObj> = PropPath<TObj>,
  TValue extends PropPathValue<TObj, TPath> = PropPathValue<TObj, TPath>
>(
  message: (path: TPath) => string,
  getArr: (d: Diagram) => Array<TItem> | ReadonlyArray<TItem>,
  getObj: (e: TItem) => DeepReadonly<TObj>,
  getStoredObj: (e: TItem) => DeepReadonly<TObj>,
  getPropertyInfo: (e: TItem, path: TPath, defaultValue?: TValue) => PropertyInfo<TValue>,
  updateObj: (e: TItem, uow: UnitOfWork, cb: (obj: TObj) => void) => void,
  subscribe: (d: Diagram, handler: () => void) => void,
  defaults: Defaults<TObj>
): PropertyArrayHook<Diagram, TObj> => {
  return ((diagram: Diagram, path: TPath, defaultValueOverride?: TValue) => {
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
      const fullArray = getArr(diagram).map(obj => accessor.get(getObj(obj) as TObj, path));
      const arr = unique(fullArray);

      if (arr.length === 1) {
        setValue((arr[0]! as TValue) ?? defaultValue);
        setValues([
          {
            val: (arr[0]! as TValue) ?? defaultValue,
            count: getArr(diagram).length
          }
        ]);
      } else {
        setValue(defaultValue);
        setValues(uniqueWithCount(fullArray).map(e => ({ val: e.val as TValue, count: e.count })));
      }

      setMultiple(arr.length > 1);
    };
    subscribe(diagram, handler);
    // biome-ignore lint/correctness/useExhaustiveDependencies: This is correct
    useEffect(handler, [defaultValueSerialized, diagram, path]);

    let isSet = true;
    if (!multiple) {
      const accessor = new DynamicAccessor<TObj>();
      const arr = unique(getArr(diagram).map(obj => accessor.get(getStoredObj(obj) as TObj, path)));
      isSet = arr.length === 1 && arr[0] !== undefined;
    }

    return {
      val: value,
      set: (v: TValue) => {
        UnitOfWork.executeWithUndo(diagram, message(path), uow => {
          getArr(diagram).forEach(n => {
            updateObj(n, uow, p => {
              accessor.set(p, path, v);
            });
          });
        });
        setValue(v ?? defaultValue);
        setMultiple(false);

        // Need to force redraw, as the current value may be the same as
        // the default value - but the isDefaultVal might result in a different result
        redraw();
      },
      hasMultipleValues: multiple,
      isSet: isSet,
      info:
        multiple || getArr(diagram)[0] === undefined
          ? undefined
          : getPropertyInfo(getArr(diagram)[0]!, path, defaultValueOverride),
      values: values
    };
  }) as PropertyArrayHook<Diagram, TObj>;
};
