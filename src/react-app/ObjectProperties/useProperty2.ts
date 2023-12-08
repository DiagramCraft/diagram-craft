import { useEffect, useState } from 'react';
import { unique } from '../../utils/array.ts';
import {
  Commitable,
  EventEmitter,
  EventKey,
  EventMap,
  Observable,
  WithWildcardEvent
} from '../../utils/event.ts';
import { DeepKeyOf, DynamicAccessor } from './useProperty.ts';

/* --------------------------------------------------------------------- */

export const useProperty = <
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  I,
  T extends Commitable = Commitable,
  EV extends EventMap = EventMap,
  EN extends EventKey<WithWildcardEvent<EV>> = EventKey<WithWildcardEvent<EV>>,
  K extends DeepKeyOf<I> = DeepKeyOf<I>
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

export const useFlyweightProperty = <
  EV extends EventMap,
  EN extends EventKey<WithWildcardEvent<EV>>,
  T extends Commitable,
  K extends DeepKeyOf<T> = DeepKeyOf<T>
>(
  target: EventEmitter<EV>,
  eventName: EN,
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
    target.on(eventName, handler);
    return () => {
      target.off(eventName, handler);
    };
  });

  const accessor = new DynamicAccessor<T>();

  return [
    value,
    v => {
      accessor.set(obj, propertyString, v);
      obj.commit();
    }
  ];
};
