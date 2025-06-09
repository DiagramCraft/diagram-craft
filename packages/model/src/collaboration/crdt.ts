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

type CRDTCompatibleObject<T> = CRDTCompatiblePrimitive | unknown extends T
  ? never
  : {
      [P in keyof T]: T[P] extends CRDTValue
        ? T[P]
        : T[P] extends NotAssignableToCRDT
          ? never
          : CRDTCompatibleObject<T[P]>;
    };

export type CRDTCompatibleValue<T> = CRDTCompatiblePrimitive | CRDTCompatibleObject<T>;

export interface CRDTRoot {
  getMap<T extends CRDTCompatibleObject<T>>(name: string): CRDTMap<T>;
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

export interface CRDTMap<T extends CRDTCompatibleValue<T>> extends Emitter<CRDTMapEvents<T>> {
  size: number;
  get(key: string): T | undefined;
  set(key: string, value: T): void;
  delete(key: string): void;
  clear(): void;
  has(key: string): boolean;
  entries(): Iterable<[string, T]>;
  keys(): Iterable<string>;
  values(): Iterable<T>;
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

export class CRDTProperty<T extends CRDTCompatibleValue<T> = string> {
  constructor(private name: string) {}

  get(target: CRDTMap<T>): T {
    return target.get(this.name) as T;
  }

  set(target: CRDTMap<T>, value: T) {
    target.set(this.name, value);
  }

  initialize(target: CRDTMap<T>, value: T) {
    if (!target.has(this.name)) {
      target.set(this.name, value);
    }
  }
}

export const CRDT = new (class {
  get Root(): new (...args: unknown[]) => CRDTRoot {
    return CollaborationConfig.CRDTRoot;
  }
})();
