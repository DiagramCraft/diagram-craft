import { CollaborationConfig } from './collaborationConfig';
import { Emitter } from '@diagram-craft/utils/event';

type CRDTCompatiblePrimitive =
  | string
  | number
  | boolean
  | null
  | undefined
  | Uint8Array

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | CRDTMap<any>

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | CRDTList<any>;

type CRDTValue =
  | CRDTCompatiblePrimitive
  | CRDTValue[]
  | {
      [key: string]: CRDTValue;
    };

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
type NotAssignableToCRDT = bigint | symbol | Function;

export type CRDTCompatibleObject<T> = CRDTCompatiblePrimitive | unknown extends T
  ? never
  : {
      [P in keyof T]: T[P] extends CRDTValue
        ? T[P]
        : T[P] extends NotAssignableToCRDT
          ? never
          : CRDTCompatibleObject<T[P]>;
    };

export type CRDTCompatibleValue<T = unknown> = CRDTCompatiblePrimitive | CRDTCompatibleObject<T>;

export interface CRDTRoot {
  getMap<T extends { [key: string]: CRDTCompatibleValue<T[string]> }>(name: string): CRDTMap<T>;
  getList<T extends CRDTCompatibleObject<T>>(name: string): CRDTList<T>;

  transact(callback: () => void): void;
}

export type CRDTMapEvents<T extends CRDTCompatibleValue<T>> = {
  localInsert: { key: string; value: T };
  localDelete: { key: string; value: T };
  localUpdate: { key: string; value: T };

  remoteInsert: { key: string; value: T };
  remoteDelete: { key: string; value: T };
  remoteUpdate: { key: string; value: T };
};

export interface CRDTMap<T extends { [key: string]: CRDTCompatibleValue<T[string]> }>
  extends Emitter<CRDTMapEvents<T[string]>> {
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

export interface CRDTList<T extends CRDTCompatibleValue<T>> extends Emitter<CRDTListEvents<T>> {
  length: number;
  clear(): void;
  get(index: number): T;
  insert(index: number, value: Array<T>): void;
  push(value: T): void;
  delete(index: number): void;
  toArray(): Array<T>;
}

export const CRDT = new (class {
  get Root(): new (...args: unknown[]) => CRDTRoot {
    return CollaborationConfig.CRDTRoot;
  }
})();
