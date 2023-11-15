type DeepWriteable<T> = { -readonly [P in keyof T]: DeepWriteable<T[P]> };

export abstract class MutableSnapshot<T> {
  protected value: DeepWriteable<T>;

  constructor(value: T) {
    this.value = value;
  }

  get<K extends keyof T>(k: K) {
    return this.value[k];
  }

  set<K extends keyof T>(k: K, v: T[K]) {
    this.value[k] = v;
  }

  abstract getSnapshot(): T;
}
