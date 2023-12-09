import { useEffect, useState } from 'react';
import { Observable } from '../../utils/event.ts';
import { DynamicAccessor, PropPath, PropPathValue } from './useProperty.ts';

/* eslint-disable @typescript-eslint/no-explicit-any */
/* --------------------------------------------------------------------- */

// TODO: Remove this one
export const useProperty = <
  T extends Observable<any>,
  K extends PropPath<T> = PropPath<T>,
  V extends PropPathValue<T, K> = PropPathValue<T, K>,
  DV extends V = V
>(
  obj: T,
  propertyString: K,
  defaultValue: DV
): [V, (value: V) => void] => {
  const accessor = new DynamicAccessor<T>();

  const [value, setValue] = useState<V>(defaultValue);
  const handler = () => {
    const value = accessor.get(obj, propertyString);

    if (value === undefined || value === null) return setValue(defaultValue);
    else return setValue(value as unknown as V);
  };
  useEffect(handler, [obj, propertyString]);
  useEffect(() => {
    obj.on('change', handler);
    return () => {
      obj.off('change', handler);
    };
  }, [handler, obj]);

  return [
    value,
    v => {
      accessor.set(obj, propertyString, v);
      obj.commit();
    }
  ];
};
