export type Property<V> = {
  val: V;
  set: (value: V | undefined) => void;
  hasMultipleValues: boolean;
  isSet: boolean;
};
