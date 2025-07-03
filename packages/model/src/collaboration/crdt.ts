import { CollaborationConfig } from './collaborationConfig';
import { Emitter } from '@diagram-craft/utils/event';
import { DeepReadonly, EmptyObject } from '@diagram-craft/utils/types';
import { VERIFY_NOT_REACHED } from '@diagram-craft/utils/assert';
import { isPrimitive } from '@diagram-craft/utils/object';
import { unique } from '@diagram-craft/utils/array';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CRDTCompatibleObject = CRDTMap<any> | CRDTList<any> | CRDTCompatibleInnerObject;

type CRDTCompatibleInnerObject =
  | string
  | number
  | boolean
  | null
  | undefined
  | Uint8Array
  | Array<CRDTCompatibleInnerObject>
  | ReadonlyArray<CRDTCompatibleObject>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | CRDTMap<any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | CRDTList<any>
  | AdditionalCRDTCompatibleInnerObjects[keyof AdditionalCRDTCompatibleInnerObjects]
  | { [key: string]: Pick<CRDTCompatibleInnerObject, keyof CRDTCompatibleInnerObject> };

declare global {
  interface AdditionalCRDTCompatibleInnerObjects {}
}

export interface CRDTFactory {
  makeMap<T extends Record<string, CRDTCompatibleObject>>(): CRDTMap<T>;
  makeList<T extends CRDTCompatibleObject>(): CRDTList<T>;
}

export interface CRDTRoot {
  readonly factory: CRDTFactory;

  clear(): void;

  getMap<T extends { [key: string]: CRDTCompatibleObject }>(name: string): CRDTMap<T>;
  getList<T extends CRDTCompatibleObject>(name: string): CRDTList<T>;

  transact(callback: () => void): void;
}

export type CRDTMapEvents<T extends CRDTCompatibleObject> = {
  localInsert: { key: string; value: T };
  localDelete: { key: string; value: T };
  localUpdate: { key: string; value: T };
  localTransaction: EmptyObject;

  remoteInsert: { key: string; value: T };
  remoteDelete: { key: string; value: T };
  remoteUpdate: { key: string; value: T };
  remoteTransaction: EmptyObject;
};

export interface CRDTMap<T extends { [key: string]: CRDTCompatibleObject }>
  extends Emitter<CRDTMapEvents<T[string]>> {
  readonly factory: CRDTFactory;

  size: number;
  get<K extends keyof T & string>(key: K, factory?: () => T[K]): T[K] | undefined;
  set<K extends keyof T & string>(key: K, value: undefined | T[K]): void;
  delete<K extends keyof T & string>(K: K): void;
  clear(): void;
  has<K extends keyof T & string>(key: K): boolean;
  entries(): Iterable<[string, T[string]]>;
  keys(): Iterable<string>;
  values(): Iterable<T[string]>;

  transact(callback: () => void): void;
}

export type CRDTListEvents<T> = {
  localInsert: { index: number; value: Array<T> };
  localDelete: { index: number; count: number };
  localTransaction: EmptyObject;

  remoteInsert: { index: number; value: Array<T> };
  remoteDelete: { index: number; count: number };
  remoteTransaction: EmptyObject;
};

export interface CRDTList<T extends CRDTCompatibleObject> extends Emitter<CRDTListEvents<T>> {
  readonly factory: CRDTFactory;

  length: number;
  clear(): void;
  get(index: number): T;
  insert(index: number, value: Array<T>): void;
  push(value: T): void;
  delete(index: number): void;
  toArray(): Array<T>;

  transact(callback: () => void): void;

  // TODO: Ability to iterate
}

export type CRDTProperty<
  T extends { [key: string]: CRDTCompatibleObject },
  N extends keyof T & string
> = {
  get: () => T[N] | undefined;
  set: (v: T[N]) => void;
};

type NoObj<O> = O extends object ? never : O;

type Entry = { key: string; value: unknown };

type FlattenToEntries<O, P extends string = ''> = O extends object
  ? {
      [K in keyof O]: K extends string
        ? P extends ''
          ? FlattenToEntries<O[K], K> | { key: K; value: NoObj<O[K]> }
          : FlattenToEntries<O[K], `${P}.${K}`> | { key: `${P}.${K}`; value: NoObj<O[K]> }
        : never;
    }[keyof O]
  : never;

type FromEntries<T extends Entry> = {
  [E in T as E['value'] extends never ? never : E['key']]: E['value'];
};

export type Flatten<O> = FromEntries<FlattenToEntries<O>> & { [key: string]: CRDTCompatibleObject };

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

export const CRDT = new (class {
  makeRoot(): CRDTRoot {
    return new CollaborationConfig.CRDTRoot();
  }

  makeProp<T extends { [key: string]: CRDTCompatibleObject }, N extends keyof T & string>(
    name: N,
    crdt: CRDTMap<T>,
    onChange: (type: 'local' | 'remote') => void = () => {}
  ): CRDTProperty<T, N> {
    crdt.on('localUpdate', p => {
      if (p.key === name) {
        onChange('local');
      }
    });
    crdt.on('remoteUpdate', p => {
      if (p.key === name) {
        onChange('remote');
      }
    });

    return {
      get: () => crdt.get(name),
      set: (v: T[keyof T & string]) => crdt.set(name, v)
    };
  }
})();
