import { unique } from '@diagram-craft/utils/array';
import { assert, VERIFY_NOT_REACHED } from '@diagram-craft/utils/assert';
import { deepCloneOverride, isPrimitive } from '@diagram-craft/utils/object';
import { DeepReadonly } from '@diagram-craft/utils/types';
import type { CRDTCompatibleObject, CRDTMap } from '../crdt';
import type { WatchableValue } from '@diagram-craft/utils/watchableValue';

type OnDemandValue<T> = () => T;

class CRDTObjectProxyHandler<T extends object> implements ProxyHandler<T> {
  readonly #isTopLevel: boolean;

  constructor(
    private readonly crdtObject: CRDTObject<any>,
    private readonly path: string
  ) {
    this.#isTopLevel = path === '';
  }

  static create<T extends CRDTCompatibleObject & object>(
    obj: CRDTObject<T>,

    v: OnDemandValue<{
      keys(): Iterable<string>;
      set(k: string, v: string | number): void;
      delete(k: string): void;
    }>
  ): T {
    return new Proxy<T>({} as unknown as T, new CRDTObjectProxyHandler(obj, ''));
  }

  private subProxy(path: string, target = {}) {
    return new Proxy<T>(target as unknown as T, new CRDTObjectProxyHandler(this.crdtObject, path));
  }

  getOwnPropertyDescriptor(_target: T, prop: string | symbol): PropertyDescriptor | undefined {
    if (this.#isTopLevel && (prop === 'toJSON' || prop === deepCloneOverride)) return undefined;
    if (prop === 'length') return { writable: true, enumerable: false, configurable: false };
    return { enumerable: true, configurable: true, writable: true };
  }

  ownKeys(_target: T): ArrayLike<string | symbol> {
    const keys: Array<string | symbol> = unique(
      Array.from(this.crdtObject.crdt.keys())
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

  get(target: T, prop: string | symbol, _receiver: any): any {
    if (this.#isTopLevel && (prop === 'toJSON' || prop === deepCloneOverride)) {
      return () => this.crdtObject.getClone();
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
      const keys = Array.from(this.crdtObject.crdt.keys())
        .filter(k => this.path === '' || k.startsWith(`${this.path}.`))
        .map(k => (this.path === '' ? k : k.substring(this.path.length + 1)))
        .map(k => k.split('.')[0])
        .filter(k => !Number.isNaN(Number(k)));

      if (keys.length > 0) {
        return Math.max(...keys.map(k => Number(k))) + 1;
      }
      return 0;
    }

    const map = this.crdtObject.crdt;

    const fullPath = this.path ? `${this.path}.${prop}` : prop;
    const value = map.get(fullPath);

    if (value === undefined) {
      if (map.has(fullPath)) return this.subProxy(fullPath);

      const keys = Array.from(this.crdtObject.crdt.keys()).filter(k =>
        k.startsWith(`${fullPath}.`)
      );
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

  set(_target: T, prop: string | symbol, value: any): boolean {
    if (typeof prop !== 'string') return VERIFY_NOT_REACHED();

    const fullPath = this.path ? `${this.path}.${prop}` : prop;

    const map = this.crdtObject.crdt;

    if (value === undefined) {
      map.delete(fullPath);
      for (const k of this.crdtObject.crdt.keys()) {
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
        for (const k of Array.from(this.crdtObject.crdt.keys())) {
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

export class CRDTObject<T extends CRDTCompatibleObject & object> {
  #proxy: T | undefined;
  #current: CRDTMap;

  constructor(
    crdt: WatchableValue<CRDTMap>,
    readonly onRemoteChange: () => void
  ) {
    this.#current = crdt.get();
    this.#current.on('remoteAfterTransaction', onRemoteChange);

    crdt.on('change', () => {
      this.#current.off('remoteAfterTransaction', onRemoteChange);

      this.#current = crdt.get();
      this.#current.on('remoteAfterTransaction', onRemoteChange);
    });
  }

  get crdt() {
    return this.#current;
  }

  get(): DeepReadonly<T> {
    this.#proxy ??= this.createProxy();
    return this.#proxy;
  }

  getClone(): DeepReadonly<T> {
    const result: Record<string, unknown> = {};
    const map = this.#current;

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
  }

  update(callback: (obj: T) => void) {
    this.#proxy ??= this.createProxy();
    this.#current.transact(() => callback(this.#proxy!));
  }

  set(obj: T) {
    this.#proxy ??= this.createProxy();
    this.#current.transact(() => {
      // First, find all top-level keys that exist in the CRDT but not in the new object
      const existingTopLevelKeys = new Set(
        Array.from(this.#current.keys()).map(k => k.split('.')[0])
      );
      const newKeys = new Set(Object.keys(obj));

      // Delete keys that are missing from the new object
      for (const key of existingTopLevelKeys.difference(newKeys)) {
        // biome-ignore lint/suspicious/noExplicitAny: false positive
        this.#proxy![key as keyof T] = undefined as any;
      }

      // Then set the new values
      if (Array.isArray(obj)) {
        for (let i = 0; i < obj.length; i++) {
          // @ts-expect-error
          this.#proxy![i] = obj[i];
        }
      } else {
        for (const key in obj) {
          this.#proxy![key] = obj[key];
        }
      }
    });
  }

  init(obj: T) {
    if (Array.from(this.#current.keys()).length === 0) {
      this.set(obj);
    }
  }

  createProxy(): T {
    return CRDTObjectProxyHandler.create(this, () => this.crdt);
  }
}
