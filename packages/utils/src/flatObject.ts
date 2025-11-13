import { DeepReadonly } from './types';
import { DynamicValue } from './dynamicValue';
import { assert, VERIFY_NOT_REACHED } from './assert';
import { deepCloneOverride, isPrimitive } from './object';
import { unique } from './array';

type MapLike<V> = {
  keys(): Iterable<string>;
  set(k: string, v: V | undefined): void;
  delete(k: string): void;
  has(k: string): boolean;
  get(k: string): V | undefined;
  entries(): Iterable<[string, V]>;
};

type DefaultValue = string | number | boolean | undefined;

/**
 * Represents an object with string keys and primitive values.
 * Useful for typing simple key-value objects.
 */
export type FlatObject = Record<string, DefaultValue>;

export const fromFlatObjectMap = <T, V = DefaultValue>(map: MapLike<V>) => {
  const result: Record<string, unknown> = {};

  for (const [path, value] of map.entries()) {
    const parts = path.split('.');
    // biome-ignore lint/suspicious/noExplicitAny: false positive
    let current: any = result;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i]!;

      if (!(part in current)) {
        // If the next part is a number, create an array, otherwise create an object
        const nextPart = i + 1 < parts.length ? parts[i + 1] : '';
        const nextIsArrayIndex = !Number.isNaN(Number(nextPart));

        const isArrayIndex = !Number.isNaN(Number(part));
        if (isArrayIndex && !Array.isArray(current)) {
          assert.true(Object.keys(current).length === 0);
          current = [];
        }

        current[part] = nextIsArrayIndex ? [] : {};
      }

      current = current[part] as Record<string, unknown>;
    }

    const lastPart = parts[parts.length - 1]!;
    if (value !== undefined) {
      current[lastPart] = value;
    } else if (!(lastPart in current)) {
      // Check if this is part of an array
      const isArrayIndex = !Number.isNaN(Number(lastPart));
      if (isArrayIndex && !Array.isArray(current)) {
        assert.true(Object.keys(current).length === 0);
        current = [];
      }

      current[lastPart] = {};
    }
  }

  return result as DeepReadonly<T>;
};

export class FlatObjectMapProxy<T extends object, V = DefaultValue> implements ProxyHandler<T> {
  readonly #isTopLevel: boolean;

  constructor(
    private readonly obj: DynamicValue<MapLike<V>>,
    private readonly path: string,
    private readonly clone: () => DeepReadonly<T>
  ) {
    this.#isTopLevel = path === '';
  }

  static create<T extends object, V = DefaultValue>(
    obj: DynamicValue<MapLike<V>>,
    clone: () => DeepReadonly<T>
  ): T {
    return new Proxy<T>({} as unknown as T, new FlatObjectMapProxy(obj, '', clone));
  }

  private subProxy(path: string, target = {}) {
    return new Proxy<T>(target as unknown as T, new FlatObjectMapProxy(this.obj, path, this.clone));
  }

  getOwnPropertyDescriptor(_target: T, prop: string | symbol): PropertyDescriptor | undefined {
    if (this.#isTopLevel && (prop === 'toJSON' || prop === deepCloneOverride)) return undefined;
    if (prop === 'length') return { writable: true, enumerable: false, configurable: false };
    return { enumerable: true, configurable: true, writable: true };
  }

  ownKeys(_target: T): ArrayLike<string | symbol> {
    const keys: Array<string | symbol> = unique(
      Array.from(this.obj.get().keys())
        .filter(k => this.path === '' || k.startsWith(`${this.path}.`))
        .map(k => (this.path === '' ? k : k.substring(this.path.length + 1)))
        .map(k => k.split('.')[0]!)
    );

    // If this is an array-like object (all keys are numeric), include 'length'
    const isArrayLike = keys.length > 0 && keys.every(k => !Number.isNaN(Number(k)));
    if (isArrayLike && !keys.includes('length')) {
      keys.push('length');
    }

    if (this.#isTopLevel) {
      keys.push('toJSON');
      keys.push(deepCloneOverride);
    }

    return keys;
  }

  // biome-ignore lint/suspicious/noExplicitAny: Valid any
  get(target: T, prop: string | symbol, _receiver: any): any {
    if (this.#isTopLevel && (prop === 'toJSON' || prop === deepCloneOverride)) {
      return () => this.clone();
    }

    const isValidTarget = target === undefined || Array.isArray(target);
    const propKey = prop as keyof typeof target;

    if (prop === Symbol.iterator) {
      if (!isValidTarget) return undefined;
      return target[Symbol.iterator] ?? undefined;
    }
    if (prop === Symbol.toStringTag) {
      if (!isValidTarget) return undefined;
      return target[propKey] ?? undefined;
    }
    if (typeof prop !== 'string') return VERIFY_NOT_REACHED();

    if (target[propKey] !== undefined) return target[propKey];

    // Handle 'length' property for array-like objects
    if (prop === 'length') {
      const keys = Array.from(this.obj.get().keys())
        .filter(k => this.path === '' || k.startsWith(`${this.path}.`))
        .map(k => (this.path === '' ? k : k.substring(this.path.length + 1)))
        .map(k => k.split('.')[0])
        .filter(k => !Number.isNaN(Number(k)));

      if (keys.length > 0) {
        return Math.max(...keys.map(k => Number(k))) + 1;
      }
      return 0;
    }

    const map = this.obj.get();

    const fullPath = this.path ? `${this.path}.${prop}` : prop;
    const value = map.get(fullPath);

    if (value === undefined) {
      if (map.has(fullPath)) return this.subProxy(fullPath);

      const keys = Array.from(this.obj.get().keys()).filter(k => k.startsWith(`${fullPath}.`));
      if (keys.length === 0) {
        return undefined;
      } else if (
        keys.every(k => !Number.isNaN(Number(k.substring(fullPath.length + 1).split('.')[0])))
      ) {
        const numericKeys = keys.map(k => Number(k.substring(fullPath.length + 1).split('.')[0]));
        return this.subProxy(
          fullPath,
          unique(numericKeys.sort((a, b) => a - b)).map(key => this.subProxy(`${fullPath}.${key}`))
        );
      } else {
        return this.subProxy(fullPath);
      }
    } else if (isPrimitive(value)) {
      return value;
    }

    return this.subProxy(fullPath);
  }

  // biome-ignore lint/suspicious/noExplicitAny: Valid use
  set(_target: T, prop: string | symbol, value: any): boolean {
    if (typeof prop !== 'string') return VERIFY_NOT_REACHED();

    const fullPath = this.path ? `${this.path}.${prop}` : prop;

    const map = this.obj.get();

    if (value === undefined) {
      map.delete(fullPath);
      for (const k of this.obj.get().keys()) {
        if (k.startsWith(`${fullPath}.`)) {
          map.delete(k);
        }
      }
    } else {
      if (isPrimitive(value)) {
        // biome-ignore lint/suspicious/noExplicitAny: false positive
        map.set(fullPath, value as any);
      } else if (value instanceof Object && Object.keys(value).length === 0) {
        map.set(fullPath, undefined);
      } else {
        // First, remove all existing nested properties under this path
        for (const k of Array.from(this.obj.get().keys())) {
          if (k.startsWith(`${fullPath}.`)) {
            map.delete(k);
          }
        }

        // Then set the new nested values
        // biome-ignore lint/suspicious/noExplicitAny: false positive
        const setNestedValue = (nestedValue: any, currentPath: string) => {
          if (isPrimitive(nestedValue)) {
            // biome-ignore lint/suspicious/noExplicitAny: false positive
            map.set(currentPath, nestedValue as any);
          } else if (nestedValue !== null && typeof nestedValue === 'object') {
            for (const key in nestedValue) {
              const nextPath = currentPath ? `${currentPath}.${key}` : key;
              setNestedValue(nestedValue[key], nextPath);
            }
          }
        };
        setNestedValue(value, fullPath);
      }
    }
    return true;
  }
}
