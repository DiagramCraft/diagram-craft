import { CRDTList, CRDTListEvents, CRDTMap, CRDTMapEvents, CRDTRoot } from '../crdt';
import * as Y from 'yjs';
import { EventEmitter, EventKey, EventReceiver } from '@diagram-craft/utils/event';
import { mapIterator } from '@diagram-craft/utils/iterator';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const wrap = (e: any) => {
  if (e instanceof Y.Array) {
    return new YJSList(e);
  } else if (e instanceof Y.Map) {
    return new YJSMap(e);
  } else {
    return e;
  }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const unwrap = (e: any) => {
  if (e instanceof YJSMap) {
    return e.delegate;
  } else if (e instanceof YJSList) {
    return e.delegate;
  } else {
    return e;
  }
};

export class YJSRoot implements CRDTRoot {
  private readonly doc = new Y.Doc();

  constructor() {}

  get yDoc() {
    return this.doc;
  }

  getMap(name: string) {
    return wrap(this.doc.getMap(name));
  }

  getList(name: string) {
    return wrap(this.doc.getArray(name));
  }

  transact(callback: () => void) {
    this.doc.transact(callback);
  }
}

export class YJSMap<T> implements CRDTMap<T> {
  private emitter = new EventEmitter<CRDTMapEvents>();
  delegate: Y.Map<T>;

  constructor(delegate?: Y.Map<T>) {
    this.delegate = delegate ?? new Y.Map();

    this.delegate.observe(e => {
      const local = e.transaction.local;
      e.changes.keys.forEach((change, key) => {
        if (change.action === 'add') {
          this.emitter.emit(local ? 'localInsert' : 'remoteInsert', {
            key,
            value: wrap(this.delegate.get(key))
          });
        } else if (change.action === 'update') {
          this.emitter.emit(local ? 'localUpdate' : 'remoteUpdate', {
            key,
            value: wrap(this.delegate.get(key))
          });
        } else if (change.action === 'delete') {
          this.emitter.emit(local ? 'localDelete' : 'remoteDelete', {
            key,
            value: wrap(change.oldValue)
          });
        }
      });
    });
  }

  clear() {
    this.delegate.clear();
  }

  delete(key: string) {
    this.delegate.delete(key);
  }

  get(key: string) {
    const v = this.delegate.get(key);
    return wrap(v);
  }

  has(key: string) {
    return this.delegate.has(key);
  }

  set(key: string, value: T) {
    this.delegate.set(key, unwrap(value));
  }

  get size() {
    return this.delegate.size;
  }

  entries() {
    const delegate = this.delegate;
    return {
      [Symbol.iterator]() {
        return mapIterator<[string, T], [string, T]>(delegate.entries(), ([k, v]) => [k, wrap(v)]);
      }
    };
  }

  keys() {
    return this.delegate.keys();
  }

  values() {
    const delegate = this.delegate;
    return {
      [Symbol.iterator]() {
        return mapIterator<T, T>(delegate.values(), wrap);
      }
    };
  }

  on<K extends EventKey<CRDTMapEvents>>(eventName: K, fn: EventReceiver<CRDTMapEvents[K]>) {
    this.emitter.on(eventName, fn);
  }

  off<K extends EventKey<CRDTMapEvents>>(eventName: K, fn: EventReceiver<CRDTMapEvents[K]>) {
    this.emitter.off(eventName, fn);
  }
}

export class YJSList<T> implements CRDTList<T> {
  private emitter = new EventEmitter<CRDTListEvents>();
  delegate: Y.Array<T>;

  constructor(delegate?: Y.Array<T>) {
    this.delegate = delegate ?? new Y.Array();
    this.delegate.observe(e => {
      let idx = 0;

      for (const delta of e.changes.delta) {
        if (delta.delete !== undefined) {
          this.emitter.emit(e.transaction.local ? 'localDelete' : 'remoteDelete', {
            index: idx,
            count: delta.delete
          });
        } else if (delta.retain !== undefined) {
          idx += delta.retain;
        } else if (delta.insert !== undefined) {
          this.emitter.emit(e.transaction.local ? 'localInsert' : 'remoteInsert', {
            index: idx,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            value: (delta.insert as any[]).map(wrap)
          });
          idx += delta.insert.length;
        }
      }
    });
  }

  clear() {
    while (this.delegate.length > 0) {
      this.delegate.delete(0);
    }
  }

  get length() {
    return this.delegate.length;
  }

  get(index: number): T {
    return wrap(this.delegate.get(index));
  }

  insert(index: number, value: T[]): void {
    this.delegate.insert(index, value.map(unwrap));
  }

  push(value: T[]): void {
    this.delegate.push(unwrap(value));
  }

  delete(index: number): void {
    this.delegate.delete(index);
  }

  toArray(): T[] {
    return this.delegate.toArray().map(wrap);
  }

  on<K extends EventKey<CRDTListEvents>>(eventName: K, fn: EventReceiver<CRDTListEvents[K]>) {
    this.emitter.on(eventName, fn);
  }

  off<K extends EventKey<CRDTListEvents>>(eventName: K, fn: EventReceiver<CRDTListEvents[K]>) {
    this.emitter.off(eventName, fn);
  }
}
