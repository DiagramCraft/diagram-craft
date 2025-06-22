import { CollaborationConfig } from './collaborationConfig';
import { Emitter } from '@diagram-craft/utils/event';

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

  getMap<T extends { [key: string]: CRDTCompatibleObject }>(name: string): CRDTMap<T>;
  getList<T extends CRDTCompatibleObject>(name: string): CRDTList<T>;

  transact(callback: () => void): void;
}

export type CRDTMapEvents<T extends CRDTCompatibleObject> = {
  localInsert: { key: string; value: T };
  localDelete: { key: string; value: T };
  localUpdate: { key: string; value: T };

  remoteInsert: { key: string; value: T };
  remoteDelete: { key: string; value: T };
  remoteUpdate: { key: string; value: T };
};

export interface CRDTMap<T extends { [key: string]: CRDTCompatibleObject }>
  extends Emitter<CRDTMapEvents<T[string]>> {
  readonly factory: CRDTFactory;

  size: number;
  get<K extends keyof T & string>(key: K): T[K] | undefined;
  set<K extends keyof T & string>(key: K, value: T[K]): void;
  delete<K extends keyof T & string>(K: K): void;
  clear(): void;
  has<K extends keyof T & string>(key: K): boolean;
  entries(): Iterable<[string, T[string]]>;
  keys(): Iterable<string>;
  values(): Iterable<T[string]>;
}

export type CRDTListEvents<T> = {
  localInsert: { index: number; value: Array<T> };
  localDelete: { index: number; count: number };

  remoteInsert: { index: number; value: Array<T> };
  remoteDelete: { index: number; count: number };
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
}

export const CRDT = new (class {
  makeRoot(): CRDTRoot {
    return new CollaborationConfig.CRDTRoot();
  }
})();
