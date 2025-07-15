import { CollaborationConfig } from './collaborationConfig';
import { Emitter } from '@diagram-craft/utils/event';
import { EmptyObject } from '@diagram-craft/utils/types';

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

  clone(): CRDTMap<T>;

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

  clone(): CRDTList<T>;

  // TODO: Ability to iterate
}

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

export const CRDT = new (class {
  makeRoot(): CRDTRoot {
    return new CollaborationConfig.CRDTRoot();
  }
})();
