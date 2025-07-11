import { unique } from '@diagram-craft/utils/array';
import { VERIFY_NOT_REACHED } from '@diagram-craft/utils/assert';
import { isPrimitive } from '@diagram-craft/utils/object';
import { DeepReadonly } from '@diagram-craft/utils/types';
import type { CRDTCompatibleObject, CRDTMap, Flatten } from '../crdt';

export class CRDTObject<T extends CRDTCompatibleObject & object> {
  readonly #proxy: T;

  constructor(
    readonly map: CRDTMap<Flatten<T>>,
    readonly onChange: () => void
  ) {
    map.on('remoteTransaction', onChange);
    map.on('localTransaction', onChange);

    const createProxy = (path = ''): T => {
      return new Proxy<T>({} as unknown as T, {
        ownKeys(_target: T): ArrayLike<string | symbol> {
          return unique(
            Array.from(map.keys())
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

          const fullPath = path ? `${path}.${prop}` : prop;
          const value = this.map.get(fullPath);

          if (Array.isArray(value)) return VERIFY_NOT_REACHED();

          if (value === undefined) {
            if (this.map.has(fullPath)) return createProxy(fullPath);

            const first = Array.from(map.keys()).find(k => k.startsWith(fullPath + '.'));
            return first ? createProxy(fullPath) : undefined;
          } else if (isPrimitive(value)) {
            return value;
          }

          return createProxy(fullPath);
        },

        set: (_target, prop, value) => {
          if (typeof prop !== 'string') return VERIFY_NOT_REACHED();

          const fullPath = path ? `${path}.${prop}` : prop;

          if (value === undefined) {
            this.map.delete(fullPath);
            for (const k of map.keys()) {
              if (k.startsWith(fullPath + '.')) {
                this.map.delete(k);
              }
            }
          } else {
            if (isPrimitive(value)) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              this.map.set(fullPath, value as any);
            } else if (value instanceof Object && Object.keys(value).length === 0) {
              this.map.set(fullPath, undefined);
            } else {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const setNestedValue = (nestedValue: any, currentPath: string) => {
                if (isPrimitive(nestedValue)) {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  this.map.set(currentPath, nestedValue as any);
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

  update(callback: (obj: T) => void) {
    this.map.transact(() => callback(this.#proxy));
  }
}
