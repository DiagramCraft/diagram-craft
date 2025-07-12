import { unique } from '@diagram-craft/utils/array';
import { VERIFY_NOT_REACHED } from '@diagram-craft/utils/assert';
import { isPrimitive } from '@diagram-craft/utils/object';
import { DeepReadonly } from '@diagram-craft/utils/types';
import type { CRDTCompatibleObject, CRDTMap, Flatten } from '../crdt';
import type { WatchableValue } from '@diagram-craft/utils/watchableValue';

export class CRDTObject<T extends CRDTCompatibleObject & object> {
  readonly #proxy: T;

  constructor(
    readonly crdt: WatchableValue<CRDTMap<Flatten<T>>>,
    readonly onChange: () => void
  ) {
    let oldCrdt = crdt.get();

    oldCrdt.on('remoteTransaction', onChange);
    oldCrdt.on('localTransaction', onChange);

    crdt.on('change', () => {
      oldCrdt.off('remoteTransaction', onChange);
      oldCrdt.off('localTransaction', onChange);

      oldCrdt = crdt.get();
      oldCrdt.on('remoteTransaction', onChange);
      oldCrdt.on('localTransaction', onChange);
    });

    const createProxy = (path = ''): T => {
      return new Proxy<T>({} as unknown as T, {
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
          if (prop === Symbol.iterator) return undefined;
          if (prop === Symbol.toStringTag) return undefined;
          if (typeof prop !== 'string') return VERIFY_NOT_REACHED();

          const map = this.crdt.get();

          const fullPath = path ? `${path}.${prop}` : prop;
          const value = map.get(fullPath);

          if (Array.isArray(value)) return VERIFY_NOT_REACHED();

          if (value === undefined) {
            if (map.has(fullPath)) return createProxy(fullPath);

            const first = Array.from(crdt.get().keys()).find(k => k.startsWith(fullPath + '.'));
            return first ? createProxy(fullPath) : undefined;
          } else if (isPrimitive(value)) {
            return value;
          }

          return createProxy(fullPath);
        },

        set: (_target, prop, value) => {
          if (typeof prop !== 'string') return VERIFY_NOT_REACHED();

          const fullPath = path ? `${path}.${prop}` : prop;

          const map = this.crdt.get();

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
    const map = this.crdt.get();

    for (const [path, value] of map.entries()) {
      const parts = path.split('.');
      let current = result;

      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!(part in current)) {
          current[part] = {};
        }
        current = current[part] as Record<string, unknown>;
      }

      const lastPart = parts[parts.length - 1];
      if (value !== undefined) {
        current[lastPart] = value;
      } else if (!(lastPart in current)) {
        current[lastPart] = {};
      }
    }

    return result as DeepReadonly<T>;
  }

  update(callback: (obj: T) => void) {
    this.crdt.get().transact(() => callback(this.#proxy));
  }

  set(obj: T) {
    this.crdt.get().transact(() => {
      for (const key in obj) {
        this.#proxy[key] = obj[key];
      }
    });
  }
}
