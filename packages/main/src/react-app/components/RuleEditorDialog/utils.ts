import { DynamicAccessor, PropPath, PropPathValue } from '@diagram-craft/utils/propertyPath';
import { DeepReadonly } from '@diagram-craft/utils/types';
import { Defaults } from '@diagram-craft/model/diagramDefaults';
import type { Property } from '@diagram-craft/model/property';

export function makeProperty<
  TObj,
  K extends PropPath<TObj | DeepReadonly<TObj>> = PropPath<TObj | DeepReadonly<TObj>>,
  V extends PropPathValue<TObj | DeepReadonly<TObj>, K> = PropPathValue<
    TObj | DeepReadonly<TObj>,
    K
  >
>(obj: TObj, propertyPath: K, defaults: Defaults<TObj>, onChange: (v: V) => void): Property<V> {
  const accessor = new DynamicAccessor<TObj | DeepReadonly<TObj>>();
  const isSet = accessor.get(obj, propertyPath) !== undefined;
  return {
    val: (accessor.get(obj, propertyPath) as V) ?? (defaults.getRaw(propertyPath) as V),
    set: (v: V) => {
      accessor.set(obj, propertyPath, v);
      onChange(v);
    },
    hasMultipleValues: false,
    isSet: isSet
  } as Property<V>;
}
