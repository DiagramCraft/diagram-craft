export type Property<V> = {
  val: NonNullable<V>;
  set: (value: V) => void;
  hasMultipleValues: boolean;
  defaultVal: NonNullable<V>;
  isDefaultVal: () => boolean;
};
