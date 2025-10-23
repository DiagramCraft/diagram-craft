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
