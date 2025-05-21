import { CRDTList, CRDTMap, CRDTRoot } from './crdt';

export class NoOpCRDTMap<T> implements CRDTMap<T> {
  private backing = new Map<string, T>();

  get size() {
    return this.backing.size;
  }

  get(key: string): T | undefined {
    return this.backing.get(key);
  }

  set(key: string, value: T): void {
    this.backing.set(key, value);
  }

  delete(key: string): void {
    this.backing.delete(key);
  }

  clear(): void {
    this.backing.clear();
  }

  has(key: string): boolean {
    return this.backing.has(key);
  }

  forEach(callback: (value: T, key: string, map: CRDTMap<T>) => void): void {
    this.backing.forEach(callback);
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

class NoOpCRDTList<T> implements CRDTList<T> {
  private backing: T[] = [];

  get length() {
    return this.backing.length;
  }

  get(index: number): T {
    return this.backing[index];
  }

  insert(index: number, value: T[]): void {
    this.backing.splice(index, 0, ...value);
  }

  push(value: T[]): void {
    this.backing.push(...value);
  }

  delete(index: number): void {
    this.backing.splice(index, 1);
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
}
