import { CollaborationConfig } from './collaborationConfig';
import { Emitter } from '@diagram-craft/utils/event';

export interface CRDTRoot {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getMap(name: string): CRDTMap<any>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getList(name: string): CRDTList<any>;

  transact(callback: () => void): void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface CRDTMap<T = any> {
  size: number;
  get(key: string): T | undefined;
  set(key: string, value: T): void;
  delete(key: string): void;
  clear(): void;
  has(key: string): boolean;
  forEach(callback: (value: T, key: string, map: CRDTMap<T>) => void): void;
  entries(): IterableIterator<[string, T]>;
  keys(): IterableIterator<string>;
  values(): IterableIterator<T>;
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class CRDTMappedList<T = any, S = any> {
  #entries: T[] = [];

  constructor(
    private readonly list: CRDTList<S>,
    readonly factory: (e: S) => T,
    private readonly toCRDT: (e: T) => S
  ) {
    list.on('remoteDelete', e => {
      this.#entries.splice(e.index, e.count);
    });
    list.on('remoteInsert', e => {
      this.#entries.splice(e.index, 0, ...e.value.map(factory));
    });
  }

  get entries() {
    return this.#entries;
  }

  add(t: T) {
    this.#entries.push(t);
    this.list.push([this.toCRDT(t)]);
  }

  indexOf(t: T) {
    return this.#entries.indexOf(t);
  }

  remove(t: T) {
    const idx = this.#entries.indexOf(t);
    if (idx >= 0) {
      this.#entries.splice(idx, 1);
      this.list.delete(idx);
      return true;
    }
    return false;
  }

  toJSON() {
    return this.#entries;
  }
}

export const CRDT = new (class {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get Root(): new (...args: any[]) => CRDTRoot {
    return CollaborationConfig.CRDTRoot;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get Map(): new (...args: any[]) => CRDTMap {
    return CollaborationConfig.CRDTMap;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get List(): new (...args: any[]) => CRDTList {
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
})();
