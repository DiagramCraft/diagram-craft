import { CollaborationConfig } from './collaborationConfig';
import { Emitter } from '@diagram-craft/utils/event';

export interface CRDTRoot {
  getMap(name: string): CRDTMap;
  getList(name: string): CRDTList;

  transact(callback: () => void): void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CRDTMapEvents<T = any> = {
  localInsert: { key: string; value: T };
  localDelete: { key: string; value: T };
  localUpdate: { key: string; value: T };

  remoteInsert: { key: string; value: T };
  remoteDelete: { key: string; value: T };
  remoteUpdate: { key: string; value: T };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface CRDTMap<T = any> extends Emitter<CRDTMapEvents<T>> {
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CRDTListEvents<T = any> = {
  localInsert: { index: number; value: Array<T> };
  localDelete: { index: number; count: number };

  remoteInsert: { index: number; value: Array<T> };
  remoteDelete: { index: number; count: number };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface CRDTList<T = any> extends Emitter<CRDTListEvents<T>> {
  length: number;
  clear(): void;
  get(index: number): T;
  insert(index: number, value: Array<T>): void;
  push(value: Array<T>): void;
  delete(index: number): void;
  toArray(): Array<T>;
}

export interface CRDTBacked {
  crdt: CRDTMap;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class CRDTProperty<T = any> {
  constructor(private name: string) {}

  get(target: CRDTMap): T {
    return target.get(this.name) as T;
  }

  set(target: CRDTMap, value: T) {
    target.set(this.name, value);
  }

  initialize(target: CRDTMap, value: T) {
    if (!target.has(this.name)) {
      target.set(this.name, value);
    }
  }
}

export const CRDT = new (class {
  get Root(): new (...args: unknown[]) => CRDTRoot {
    return CollaborationConfig.CRDTRoot;
  }
  get Map(): new (...args: unknown[]) => CRDTMap {
    return CollaborationConfig.CRDTMap;
  }
  get List(): new (...args: unknown[]) => CRDTList {
    return CollaborationConfig.CRDTList;
  }

  getMap(m: CRDTMap, name: string) {
    let r = m.get(name);
    if (!r) {
      r = new CRDT.Map();
      m.set(name, r);
    }
    return r as CRDTMap;
  }

  getList(m: CRDTMap, name: string) {
    let r = m.get(name);
    if (!r) {
      r = new CRDT.List();
      m.set(name, r);
    } else if (!(r instanceof CRDT.List)) {
      throw new Error('Invalid list');
    }
    return r as CRDTList;
  }
})();
