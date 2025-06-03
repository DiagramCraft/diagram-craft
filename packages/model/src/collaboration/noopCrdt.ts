import { CRDTList, CRDTListEvents, CRDTMap, CRDTMapEvents, CRDTRoot } from './crdt';
import { EventEmitter } from '@diagram-craft/utils/event';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class NoOpCRDTMap<T = any> extends EventEmitter<CRDTMapEvents> implements CRDTMap<T> {
  private backing = new Map<string, T>();

  get size() {
    return this.backing.size;
  }

  get(key: string): T | undefined {
    return this.backing.get(key);
  }

  set(key: string, value: T): void {
    const isNew = !this.backing.has(key);
    this.backing.set(key, value);

    this.emit(isNew ? 'localInsert' : 'localUpdate', { key, value });
  }

  delete(key: string): void {
    this.backing.delete(key);
    this.emit('localDelete');
  }

  clear(): void {
    const map = { ...this.backing };
    this.backing.clear();
    Object.entries(map).forEach(([k, v]) => this.emit('localDelete', { key: k, value: v }));
  }

  has(key: string): boolean {
    return this.backing.has(key);
  }

  entries(): IterableIterator<[string, T]> {
    return this.backing.entries();
  }

  keys(): IterableIterator<string> {
    return this.backing.keys();
  }

  values(): IterableIterator<T> {
    return this.backing.values();
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class NoOpCRDTList<T = any> extends EventEmitter<CRDTListEvents> implements CRDTList<T> {
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

  push(value: T[]): void {
    this.backing.push(...value);
    this.emit('localInsert', { index: this.backing.length - 1, value });
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
  private map: Map<string, CRDTMap<unknown>> = new Map();
  private list: Map<string, CRDTList<unknown>> = new Map();

  getMap(name: string): CRDTMap<unknown> {
    let m = this.map.get(name);
    if (!m) {
      m = new NoOpCRDTMap<unknown>();
      this.map.set(name, m);
    }
    return m;
  }

  getList(name: string): CRDTList<unknown> {
    let l = this.list.get(name);
    if (!l) {
      l = new NoOpCRDTList<unknown>();
      this.list.set(name, l);
    }
    return l;
  }

  transact(callback: () => void) {
    callback();
  }
}
