import { unique } from '@diagram-craft/utils/array';
import { assert, VERIFY_NOT_REACHED } from '@diagram-craft/utils/assert';
import { isPrimitive } from '@diagram-craft/utils/object';
import { DeepReadonly } from '@diagram-craft/utils/types';
import type { CRDTCompatibleObject, CRDTMap } from '../crdt';
import type { WatchableValue } from '@diagram-craft/utils/watchableValue';

export class CRDTObject<T extends CRDTCompatibleObject & object> {
  readonly #proxy: T;
  #current: CRDTMap;

  constructor(
    crdt: WatchableValue<CRDTMap>,
    readonly onRemoteChange: () => void
  ) {
    this.#current = crdt.get();

    this.#current.on('remoteAfterTransaction', () => onRemoteChange());

    crdt.on('change', () => {
      this.#current.off('remoteAfterTransaction', () => onRemoteChange());

      this.#current = crdt.get();
      this.#current.on('remoteAfterTransaction', () => onRemoteChange());
    });

    const createProxy = (target = {}, path = ''): T => {
      return new Proxy<T>(target as unknown as T, {
        ownKeys(_target: T): ArrayLike<string | symbol> {
          return unique(
            Array.from(crdt.get().keys())
              .filter(k => path === '' || k.startsWith(path + '.'))
              .map(k => (path === '' ? k : k.substring(path.length + 1)))
              .map(k => k.split('.')[0])
          );
        },

        getOwnPropertyDescriptor(_target, _prop) {
          return { enumerable: true, configurable: true, writable: true };
        },

        get: (_target, prop) => {
          const isValidTarget = _target === undefined || Array.isArray(_target);

          if (prop === Symbol.iterator) {
            if (!isValidTarget) return undefined;
            // @ts-ignore
            return _target[Symbol.iterator] ?? undefined;
          }
          if (prop === Symbol.toStringTag) {
            if (!isValidTarget) return undefined;
            // @ts-ignore
            return _target[Symbol.toStringTag] ?? undefined;
          }
          if (typeof prop !== 'string') return VERIFY_NOT_REACHED();

          // @ts-ignore
          if (_target[prop] !== undefined) return _target[prop];

          const map = this.#current;

          const fullPath = path ? `${path}.${prop}` : prop;
          const value = map.get(fullPath);

          if (value === undefined) {
            if (map.has(fullPath)) return createProxy({}, fullPath);

            const keys = Array.from(crdt.get().keys()).filter(k => k.startsWith(fullPath + '.'));
            if (keys.length === 0) {
              return undefined;
            } else if (
              keys.every(k => !isNaN(Number(k.substring(fullPath.length + 1).split('.')[0])))
            ) {
              const numericKeys = keys.map(k =>
                Number(k.substring(fullPath.length + 1).split('.')[0])
              );
              return createProxy(
                unique(numericKeys.sort((a, b) => a - b)).map(key =>
                  createProxy({}, `${fullPath}.${key}`)
                ),
                fullPath
              );
            } else {
              return createProxy({}, fullPath);
            }
          } else if (isPrimitive(value)) {
            return value;
          }

          return createProxy({}, fullPath);
        },

        set: (_target, prop, value) => {
          if (typeof prop !== 'string') return VERIFY_NOT_REACHED();

          const fullPath = path ? `${path}.${prop}` : prop;

          const map = this.#current;

          if (value === undefined) {
            map.delete(fullPath);
            for (const k of crdt.get().keys()) {
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
    };

    this.#proxy = createProxy();
  }

  get(): DeepReadonly<T> {
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
        const part = parts[i];

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

      const lastPart = parts[parts.length - 1];
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
    this.#current.transact(() => callback(this.#proxy));
  }

  set(obj: T) {
    this.#current.transact(() => {
      for (const key in obj) {
        this.#proxy[key] = obj[key];
      }
    });
  }

  init(obj: T) {
    if (Array.from(this.#current.keys()).length === 0) {
      this.set(obj);
    }
  }
}
