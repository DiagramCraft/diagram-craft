import type {
  CRDTCompatibleObject,
  CRDTFactory,
  CRDTList,
  CRDTListEvents,
  CRDTMap,
  CRDTMapEvents,
  CRDTRoot,
  CRDTRootEvents
} from './crdt';
import { EventEmitter } from '@diagram-craft/utils/event';

export class NoOpCRDTFactory implements CRDTFactory {
  makeMap<T extends Record<string, CRDTCompatibleObject>>(initial?: T): CRDTMap<T> {
    const dest = new NoOpCRDTMap<T>();
    if (initial) {
      for (const [key, value] of Object.entries(initial)) {
        dest.set(key, value as T[string]);
      }
    }
    return dest;
  }

  makeList<T extends CRDTCompatibleObject>(initial?: Array<T>): CRDTList<T> {
    const list = new NoOpCRDTList<T>();
    if (initial) {
      for (const value of initial) {
        list.push(value);
      }
    }
    return list;
  }
}

export class NoOpCRDTMap<T extends { [key: string]: CRDTCompatibleObject }>
  extends EventEmitter<CRDTMapEvents<T[string]>>
  implements CRDTMap<T>
{
  private backing = new Map<string, T[string]>();

  readonly factory = new NoOpCRDTFactory();

  clone() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dest = new NoOpCRDTMap<any>();
    for (const [key, value] of this.entries()) {
      if (value instanceof NoOpCRDTMap) {
        dest.set(key, value.clone());
      } else if (value instanceof NoOpCRDTList) {
        dest.set(key, value.clone());
      } else {
        dest.set(key, value);
      }
    }
    return dest;
  }

  get size() {
    return this.backing.size;
  }

  get<K extends keyof T & string>(key: K, factory?: () => T[K]): T[K] | undefined {
    if (!this.backing.has(key) && factory !== undefined) {
      this.set(key, factory());
    }
    return this.backing.get(key) as T[K] | undefined;
  }

  set<K extends keyof T & string>(key: K, value: T[K]): void {
    this.backing.set(key, value);
  }

  delete<K extends keyof T & string>(key: K): void {
    this.backing.delete(key);
  }

  clear(): void {
    this.backing.clear();
  }

  has<K extends keyof T & string>(key: K): boolean {
    return this.backing.has(key);
  }

  entries(): IterableIterator<[string, T[string]]> {
    return this.backing.entries();
  }

  keys(): IterableIterator<string> {
    return this.backing.keys();
  }

  values(): IterableIterator<T[string]> {
    return this.backing.values();
  }

  transact(callback: () => void) {
    return callback();
  }
}

export class NoOpCRDTList<T extends CRDTCompatibleObject>
  extends EventEmitter<CRDTListEvents<T>>
  implements CRDTList<T>
{
  private backing: T[] = [];

  readonly factory = new NoOpCRDTFactory();

  get length() {
    return this.backing.length;
  }

  get(index: number): T {
    return this.backing[index];
  }

  clone() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dest = new NoOpCRDTList<any>();
    for (let i = 0; i < this.length; i++) {
      const value = this.get(i);
      if (value instanceof NoOpCRDTMap) {
        dest.push(value.clone());
      } else if (value instanceof NoOpCRDTList) {
        dest.push(value.clone());
      } else {
        dest.push(value);
      }
    }
    return dest;
  }

  insert(index: number, value: T[]): void {
    this.backing.splice(index, 0, ...value);
  }

  push(value: T): void {
    this.backing.push(value);
  }

  delete(index: number): void {
    this.backing.splice(index, 1);
  }

  clear() {
    while (this.backing.length > 0) {
      this.delete(0);
    }
  }

  toArray(): T[] {
    return this.backing;
  }

  transact(callback: () => void) {
    return callback();
  }
}

export class NoOpCRDTRoot extends EventEmitter<CRDTRootEvents> implements CRDTRoot {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private map: Map<string, any> = new Map();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private list: Map<string, any> = new Map();

  readonly factory = new NoOpCRDTFactory();

  hasData() {
    return this.map.size > 0 || this.list.size > 0;
  }

  getMap<T extends { [key: string]: CRDTCompatibleObject }>(name: string): CRDTMap<T> {
    let m = this.map.get(name);
    if (!m) {
      m = new NoOpCRDTMap();
      this.map.set(name, m);
    }
    return m as CRDTMap<T>;
  }

  getList<T extends CRDTCompatibleObject>(name: string): CRDTList<T> {
    let l = this.list.get(name);
    if (!l) {
      l = new NoOpCRDTList();
      this.list.set(name, l);
    }
    return l as CRDTList<T>;
  }

  clear() {
    this.map.clear();
    this.list.clear();
  }

  transact(callback: () => void) {
    return callback();
  }
}
