import { unique } from '@diagram-craft/utils/array';
import { assert, VERIFY_NOT_REACHED } from '@diagram-craft/utils/assert';
import { isPrimitive } from '@diagram-craft/utils/object';
import { DeepReadonly } from '@diagram-craft/utils/types';
import type { CRDTCompatibleObject, CRDTMap } from '../crdt';
import type { WatchableValue } from '@diagram-craft/utils/watchableValue';

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

  get(): DeepReadonly<T> {
    this.#proxy ??= this.createProxy();
    return this.#proxy;
  }

  getClone(): DeepReadonly<T> {
    const result: Record<string, unknown> = {};
    const map = this.#current;

    for (const [path, value] of map.entries()) {
      const parts = path.split('.');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let current: any = result;

      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i]!;

        if (!(part in current)) {
          // If the next part is a number, create an array, otherwise create an object
          const nextPart = i + 1 < parts.length ? parts[i + 1] : '';
          const nextIsArrayIndex = !isNaN(Number(nextPart));

          const isArrayIndex = !isNaN(Number(part));
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
        const isArrayIndex = !isNaN(Number(lastPart));
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.#proxy![key as keyof T] = undefined as any;
      }

      // Then set the new values
      if (Array.isArray(obj)) {
        for (let i = 0; i < obj.length; i++) {
          // @ts-ignore
          this.#proxy![i] = obj[i];
        }
      } else {
        // eslint-disable-next-line @typescript-eslint/no-for-in-array
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

  private createProxy(target = {}, path = ''): T {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const that = this;
    return new Proxy<T>(target as unknown as T, {
      ownKeys(_target: T): ArrayLike<string | symbol> {
        const keys = unique(
          Array.from(that.#current.keys())
            .filter(k => path === '' || k.startsWith(path + '.'))
            .map(k => (path === '' ? k : k.substring(path.length + 1)))
            .map(k => k.split('.')[0]!)
        );

        // If this is an array-like object (all keys are numeric), include 'length'
        const isArrayLike = keys.length > 0 && keys.every(k => !isNaN(Number(k)));
        if (isArrayLike && !keys.includes('length')) {
          keys.push('length');
        }

        return keys;
      },

      getOwnPropertyDescriptor(_target, _prop) {
        return { enumerable: true, configurable: true, writable: true };
      },

      get: (_target, prop) => {
        const isValidTarget = _target === undefined || Array.isArray(_target);
        const propKey = prop as keyof typeof _target;

        if (prop === Symbol.iterator) {
          if (!isValidTarget) return undefined;
          return _target[Symbol.iterator] ?? undefined;
        }
        if (prop === Symbol.toStringTag) {
          if (!isValidTarget) return undefined;
          return _target[propKey] ?? undefined;
        }
        if (typeof prop !== 'string') return VERIFY_NOT_REACHED();

        if (_target[propKey] !== undefined) return _target[propKey];

        // Handle 'length' property for array-like objects
        if (prop === 'length') {
          const keys = Array.from(this.#current.keys())
            .filter(k => path === '' || k.startsWith(path + '.'))
            .map(k => (path === '' ? k : k.substring(path.length + 1)))
            .map(k => k.split('.')[0])
            .filter(k => !isNaN(Number(k)));

          if (keys.length > 0) {
            return Math.max(...keys.map(k => Number(k))) + 1;
          }
          return 0;
        }

        const map = this.#current;

        const fullPath = path ? `${path}.${prop}` : prop;
        const value = map.get(fullPath);

        if (value === undefined) {
          if (map.has(fullPath)) return this.createProxy({}, fullPath);

          const keys = Array.from(this.#current.keys()).filter(k => k.startsWith(fullPath + '.'));
          if (keys.length === 0) {
            return undefined;
          } else if (
            keys.every(k => !isNaN(Number(k.substring(fullPath.length + 1).split('.')[0])))
          ) {
            const numericKeys = keys.map(k =>
              Number(k.substring(fullPath.length + 1).split('.')[0])
            );
            return this.createProxy(
              unique(numericKeys.sort((a, b) => a - b)).map(key =>
                this.createProxy({}, `${fullPath}.${key}`)
              ),
              fullPath
            );
          } else {
            return this.createProxy({}, fullPath);
          }
        } else if (isPrimitive(value)) {
          return value;
        }

        return this.createProxy({}, fullPath);
      },

      set: (_target, prop, value) => {
        if (typeof prop !== 'string') return VERIFY_NOT_REACHED();

        const fullPath = path ? `${path}.${prop}` : prop;

        const map = this.#current;

        if (value === undefined) {
          map.delete(fullPath);
          for (const k of this.#current.keys()) {
            if (k.startsWith(fullPath + '.')) {
              map.delete(k);
            }
          }
        } else {
          if (isPrimitive(value)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            map.set(fullPath, value as any);
          } else if (value instanceof Object && Object.keys(value).length === 0) {
            map.set(fullPath, undefined);
          } else {
            // First, remove all existing nested properties under this path
            for (const k of Array.from(this.#current.keys())) {
              if (k.startsWith(fullPath + '.')) {
                map.delete(k);
              }
            }

            // Then set the new nested values
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const setNestedValue = (nestedValue: any, currentPath: string) => {
              if (isPrimitive(nestedValue)) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    });
  }
}
