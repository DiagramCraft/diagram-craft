import { DynamicAccessor, PropPath } from '@diagram-craft/utils/propertyPath';
import { Diagram } from '@diagram-craft/model/diagram';
import { DeepReadonly } from '@diagram-craft/utils/types';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { unique, uniqueWithCount } from '@diagram-craft/utils/array';

export type Property<V> = {
  val: V;
  set: (value: V | undefined, message?: string) => void;
  hasMultipleValues: boolean;
  isSet: boolean;
  info?: PropertyInfo<V>;
  values?: Array<{
    val: V;
    count: number;
  }>;
};

export type PropertyInfo<V> = Array<PropertyInfoEntry<V>>;

type PropertyInfoEntry<V> = {
  val: V;
  type:
    | 'default'
    | 'stored'
    | 'style'
    | 'textStyle'
    | 'rule'
    | 'ruleStyle'
    | 'ruleTextStyle'
    | 'parent';
  id?: string;
};

export const makePropertyFromArray = <TItem, TObj, TPath, TValue>(
  message: string,
  array: Array<TItem>,
  getObj: (e: TItem) => DeepReadonly<TObj>,
  getStoredObj: (e: TItem) => DeepReadonly<TObj>,
  getPropertyInfo: (e: TItem) => PropertyInfo<TValue>,
  updateObj: (e: TItem, v: TValue | undefined, uow: UnitOfWork) => void,
  diagram: Diagram,
  path: TPath,
  defaultValue: TValue
): Property<NonNullable<TValue>> => {
  const accessor = new DynamicAccessor<TObj>();

  const fullArray = array.map(obj => accessor.get(getObj(obj) as TObj, path as PropPath<TObj>));
  const arr = unique(fullArray);

  let value: TValue;
  let values: Array<{ val: TValue; count: number }> | undefined;

  if (arr.length === 1) {
    value = (arr[0]! as TValue) ?? defaultValue;
    values = [{ val: value, count: array.length }];
  } else {
    value = defaultValue;
    values = uniqueWithCount(fullArray).map(e => ({ val: e.val as TValue, count: e.count }));
  }

  const multiple = arr.length > 1;

  let isSet = true;
  if (!multiple) {
    const storedArr = unique(
      array.map(obj => accessor.get(getStoredObj(obj) as TObj, path as PropPath<TObj>))
    );
    isSet = storedArr.length === 1 && storedArr[0] !== undefined;
  }

  return {
    val: value as NonNullable<TValue>,
    set: (v: NonNullable<TValue> | undefined) => {
      diagram.undoManager.execute(message, uow => {
        array.forEach(n => {
          updateObj(n, v, uow);
        });
      });
    },
    hasMultipleValues: multiple,
    isSet: isSet,
    info: multiple || array[0] === undefined ? undefined : getPropertyInfo(array[0]!),
    values: values
  } as Property<NonNullable<TValue>>;
};
