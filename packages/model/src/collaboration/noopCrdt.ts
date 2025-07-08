import type {
  CRDTCompatibleObject,
  CRDTFactory,
  CRDTList,
  CRDTListEvents,
  CRDTMap,
  CRDTMapEvents,
  CRDTRoot
} from './crdt';
import { EventEmitter } from '@diagram-craft/utils/event';
import { VERIFY_NOT_REACHED } from '@diagram-craft/utils/assert';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type NoOpCRDTTypes = NoOpCRDTMap<any> | NoOpCRDTList<any>;

type Transaction = {
  id: string;
  objects: Set<NoOpCRDTTypes>;
};

let transaction: Transaction | undefined;

const emitTransactionEvents = (obj: NoOpCRDTTypes) => {
  if (obj instanceof NoOpCRDTMap) {
    obj.emit('localTransaction', {});
  } else if (obj instanceof NoOpCRDTList) {
    obj.emit('localTransaction', {});
  } else {
    VERIFY_NOT_REACHED();
  }
};

const registerTransactionObject = (obj: NoOpCRDTTypes) => {
  if (transaction) {
    transaction.objects.add(obj);
  } else {
    // If there's no active transaction, we create an implicit transaction
    emitTransactionEvents(obj);
  }
};

const transact = (callback: () => void) => {
  if (transaction) return callback();

  transaction = {
    id: 'noop',
    objects: new Set()
  };
  try {
    callback();
  } finally {
    for (const obj of transaction.objects) {
      emitTransactionEvents(obj);
    }
    transaction = undefined;
  }
};

export class NoOpCRDTFactory implements CRDTFactory {
  makeMap<T extends Record<string, CRDTCompatibleObject>>(): CRDTMap<T> {
    return new NoOpCRDTMap();
  }

  makeList<T extends CRDTCompatibleObject>(): CRDTList<T> {
    return new NoOpCRDTList();
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
    const isNew = !this.backing.has(key);
    this.backing.set(key, value);

    this.emit(isNew ? 'localInsert' : 'localUpdate', { key, value });
    registerTransactionObject(this);
  }

  delete<K extends keyof T & string>(key: K): void {
    this.backing.delete(key);
    this.emit('localDelete');
    registerTransactionObject(this);
  }

  clear(): void {
    const map: Map<string, T[string]> = { ...this.backing };
    this.backing.clear();
    Object.entries(map).forEach(([k, v]) => this.emit('localDelete', { key: k, value: v }));
    registerTransactionObject(this);
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
    return transact(callback);
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
    this.emit('localInsert', { index, value });
    registerTransactionObject(this);
  }

  push(value: T): void {
    this.backing.push(value);
    this.emit('localInsert', { index: this.backing.length - 1, value: [value] });
    registerTransactionObject(this);
  }

  delete(index: number): void {
    this.backing.splice(index, 1);
    this.emit('localDelete', { index, count: 1 });
    registerTransactionObject(this);
  }

  clear() {
    while (this.backing.length > 0) {
      this.delete(0);
    }
    registerTransactionObject(this);
  }

  toArray(): T[] {
    return this.backing;
  }

  transact(callback: () => void) {
    return transact(callback);
  }
}

export class NoOpCRDTRoot implements CRDTRoot {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private map: Map<string, any> = new Map();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private list: Map<string, any> = new Map();

  readonly factory = new NoOpCRDTFactory();

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
    return transact(callback);
  }
}
