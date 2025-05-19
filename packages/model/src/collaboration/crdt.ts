import { CollaborationConfig } from './collaborationConfig';

export interface CRDTRoot {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getMap(name: string): CRDTMap<any>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getList(name: string): CRDTList<any>;
}

export interface CRDTMap<T> {
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

export interface CRDTList<T> {
  length: number;
  get(index: number): T;
  insert(index: number, value: Array<T>): void;
  delete(index: number): void;
}

export const CRDT = new (class {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get Root(): new (...args: any[]) => CRDTRoot {
    return CollaborationConfig.CRDTRoot;
  }
})();
