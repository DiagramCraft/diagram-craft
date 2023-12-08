import { useEffect, useState } from 'react';
import { unique } from '../../utils/array.ts';
import {
  EventEmitter,
  EventKey,
  EventMap,
  Observable,
  WithWildcardEvent
} from '../../utils/event.ts';

type DeepKeyOf<T> = (
  [T] extends [never]
    ? ''
    : T extends object
    ? {
        [K in Exclude<keyof T, symbol>]: `${K}${undefined extends T[K] ? '?' : ''}${DotPrefix<
          DeepKeyOf<T[K]>
        >}`;
      }[Exclude<keyof T, symbol>]
    : ''
) extends infer D
  ? Extract<D, string>
  : never;

type DotPrefix<T extends string> = T extends '' ? '' : `.${T}`;

class DynamicAccessor<T> {
  constructor() {}

  get<K extends DeepKeyOf<T> = DeepKeyOf<T>>(obj: T, key: K): T[K] {
    const parts = (key as string).split('.');
    let current: any = obj;
    for (const part of parts) {
      if (current === undefined) return undefined as T[K];
      current = current[part] as T[K];
    }
    return current;
  }

  set<K extends DeepKeyOf<T> = DeepKeyOf<T>>(obj: T, key: K, value: T[K]): void {
    const parts = (key as string).split('.');
    let current: any = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      current[parts[i]] ??= {};
      current = current[parts[i]];
    }
    current[parts[parts.length - 1]] = value;
  }
}

/* --------------------------------------------------------------------- */

export const useProperty = <
  E extends Observable<any> = never,
  T extends E = E,
  K extends DeepKeyOf<T> = DeepKeyOf<T>
>(
  obj: T,
  propertyString: K,
  defaultValue: T[K]
): [T[K], (value: T[K]) => void] => {
  const [value, setValue] = useState<T[K]>(defaultValue);
  const handler = () => {
    const value = accessor.get(obj, propertyString);

    if (value === undefined || value === null) return setValue(defaultValue);
    else return setValue(value);
  };
  useEffect(handler, [obj, propertyString]);
  useEffect(() => {
    obj.on('change', handler);
    return () => {
      obj.off('change', handler);
    };
  }, [handler, obj]);

  const accessor = new DynamicAccessor<T>();

  return [
    value,
    v => {
      accessor.set(obj, propertyString, v);
      obj.commit();
    }
  ];
};

export const useArrayProperty = <
  EV extends EventMap,
  EN extends EventKey<WithWildcardEvent<EV>>,
  E extends Observable<any> = never,
  T extends E = E,
  K extends DeepKeyOf<T> = DeepKeyOf<T>
>(
  target: EventEmitter<EV>,
  eventName: EN,
  arr: T[],
  propertyString: K,
  defaultValue: T[K]
): [T[K], (value: T[K]) => void, boolean] => {
  const [value, setValue] = useState<T[K]>(defaultValue);
  const [multiple, setMultiple] = useState<boolean>(false);
  const handler = () => {
    const values = unique(arr.map(obj => accessor.get(obj, propertyString)));

    setMultiple(arr.length > 1);

    if (arr.length !== 1) setValue(defaultValue);
    else setValue(values[0]!);
  };
  useEffect(handler, [arr, propertyString]);

  useEffect(() => {
    target.on(eventName, handler);
    return () => {
      target.off(eventName, handler);
    };
  });

  const accessor = new DynamicAccessor<T>();

  return [
    value,
    v => {
      arr.forEach(obj => {
        accessor.set(obj, propertyString, v);
        obj.commit();
      });
    },
    multiple
  ];
};
