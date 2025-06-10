import {
  CRDTCompatibleValue,
  CRDTList,
  CRDTListEvents,
  CRDTMap,
  CRDTMapEvents,
  CRDTRoot
} from './crdt';
import { EventEmitter } from '@diagram-craft/utils/event';

export class NoOpCRDTMap<T extends { [key: string]: CRDTCompatibleValue<T[string]> }>
  extends EventEmitter<CRDTMapEvents<T[string]>>
  implements CRDTMap<T>
{
  private backing = new Map<string, T[string]>();

  get size() {
    return this.backing.size;
  }

  get<K extends keyof T & string>(key: K): T[K] | undefined {
    return this.backing.get(key) as T[K] | undefined;
  }

  set<K extends keyof T & string>(key: K, value: T[K]): void {
    const isNew = !this.backing.has(key);
    this.backing.set(key, value);

    this.emit(isNew ? 'localInsert' : 'localUpdate', { key, value });
  }

  delete<K extends keyof T & string>(key: K): void {
    this.backing.delete(key);
    this.emit('localDelete');
  }

  clear(): void {
    const map: Map<string, T[string]> = { ...this.backing };
    this.backing.clear();
    Object.entries(map).forEach(([k, v]) => this.emit('localDelete', { key: k, value: v }));
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
}

export class NoOpCRDTList<T extends CRDTCompatibleValue<T>>
  extends EventEmitter<CRDTListEvents<T>>
  implements CRDTList<T>
{
  private backing: T[] = [];

  get length() {
    return this.backing.length;
  }

  get(index: number): T {
    return this.backing[index];
  }

  insert(index: number, value: T[]): void {
    this.backing.splice(index, 0, ...value);
    this.emit('localInsert', { index, value });
  }

  push(value: T): void {
    this.backing.push(value);
    this.emit('localInsert', { index: this.backing.length - 1, value: [value] });
  }

  delete(index: number): void {
    this.backing.splice(index, 1);
    this.emit('localDelete', { index, count: 1 });
  }

  clear() {
    while (this.backing.length > 0) {
      this.delete(0);
    }
  }

  toArray(): T[] {
    return this.backing;
  }
}

export class NoOpCRDTRoot implements CRDTRoot {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private map: Map<string, any> = new Map();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private list: Map<string, any> = new Map();

  getMap<T extends { [key: string]: CRDTCompatibleValue<T[string]> }>(name: string): CRDTMap<T> {
    let m = this.map.get(name);
    if (!m) {
      m = new NoOpCRDTMap();
      this.map.set(name, m);
    }
    return m as CRDTMap<T>;
  }

  getList<T extends CRDTCompatibleValue<T>>(name: string): CRDTList<T> {
    let l = this.list.get(name);
    if (!l) {
      l = new NoOpCRDTList();
      this.list.set(name, l);
    }
    return l as CRDTList<T>;
  }

  transact(callback: () => void) {
    callback();
  }
}
