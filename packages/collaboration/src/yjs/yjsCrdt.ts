import {
  CRDTCompatibleObject,
  CRDTFactory,
  CRDTList,
  CRDTListEvents,
  CRDTMap,
  CRDTMapEvents,
  CRDTRoot,
  type CRDTRootEvents
} from '../crdt';
import * as Y from 'yjs';
import { EventEmitter, EventKey, EventReceiver } from '@diagram-craft/utils/event';
import { getActiveYjsUndoOrigin } from './yjsUndoTrackingContext';

const shouldEmitObservableTransactionEvents = (transaction: Y.Transaction) => {
  return !transaction.local || transaction.origin instanceof Y.UndoManager;
};

const withActiveUndoOrigin = <T>(doc: Y.Doc | null | undefined, callback: () => T): T => {
  if (!doc || doc._transaction) {
    return callback();
  }

  const origin = getActiveYjsUndoOrigin(doc);
  if (origin === undefined) {
    return callback();
  }

  let result!: T;
  doc.transact(() => {
    result = callback();
  }, origin);
  return result;
};

// biome-ignore lint/suspicious/noExplicitAny: false positive
const wrap = (e: any): any => {
  if (e instanceof Y.Array) {
    return new YJSList<CRDTCompatibleObject>(e as Y.Array<CRDTCompatibleObject>);
  } else if (e instanceof Y.Map) {
    return new YJSMap<Record<string, CRDTCompatibleObject>>(
      e as Y.Map<Record<string, CRDTCompatibleObject>>
    );
  } else {
    return e;
  }
};

// biome-ignore lint/suspicious/noExplicitAny: false positive
const unwrap = (e: any): any => {
  if (e instanceof YJSMap) {
    return e.delegate;
  } else if (e instanceof YJSList) {
    return e.delegate;
  } else {
    return e;
  }
};

function* mapIterator<T, K>(iterator: IterableIterator<T>, callback: (value: T) => K): Iterator<K> {
  for (const value of iterator) {
    yield callback(value);
  }
}

export class YJSFactory implements CRDTFactory {
  makeMap<T extends Record<string, CRDTCompatibleObject>>(initial?: T): YJSMap<T> {
    const dest = new YJSMap<T>();
    if (initial) {
      for (const [key, value] of Object.entries(initial)) {
        dest.set(key, value as T[string]);
      }
    }
    return dest;
  }

  makeList<T extends CRDTCompatibleObject>(initial?: Array<T>): YJSList<T> {
    const list = new YJSList<T>();
    if (initial) {
      for (const value of initial) {
        list.push(value);
      }
    }
    return list;
  }
}

export class YJSRoot extends EventEmitter<CRDTRootEvents> implements CRDTRoot {
  private readonly doc: Y.Doc;

  readonly factory = new YJSFactory();
  private data: Y.Map<unknown>;

  constructor(existingDoc?: Y.Doc) {
    super();
    this.doc = existingDoc ?? new Y.Doc();
    this.data = this.doc.getMap('data');

    this.doc.on('beforeTransaction', t => {
      if (shouldEmitObservableTransactionEvents(t)) this.emit('remoteBeforeTransaction', {});
    });
    this.doc.on('afterTransaction', t => {
      if (shouldEmitObservableTransactionEvents(t)) this.emit('remoteAfterTransaction', {});
    });

    this.data.observe((_e, t) => {
      if (!shouldEmitObservableTransactionEvents(t)) return;
      const keys = [...this.data.keys()];
      if (keys.length === 0) this.emit('remoteClear');
    });

    /*let count = 0;
    this.doc.on('beforeTransaction', t => {
      if (t.local) {
        console.log('beforeTransaction', ++count);
        console.log(new Error().stack);
      }
    });
    this.doc.on('afterTransaction', t => {
      if (t.local) {
        console.log('afterTransaction');
        for (const [k, v] of t.changed) {
          console.log(k, v);
          Y.logType(k);
        }
      }
    });*/
  }

  get yDoc() {
    return this.doc;
  }

  get yData() {
    return this.data;
  }

  hasData() {
    return [...this.data.keys()].length > 0;
  }

  clear() {
    withActiveUndoOrigin(this.doc, () => this.data.clear());
  }

  getMap<T extends { [key: string]: CRDTCompatibleObject }>(name: string): YJSMap<T> {
    if (!this.data.has(name)) {
      this.data.set(name, new Y.Map<Record<string, CRDTCompatibleObject>>());
    }

    return wrap(this.data.get(name)) as YJSMap<T>;
  }

  getList<T extends CRDTCompatibleObject>(name: string): YJSList<T> {
    if (!this.data.has(name)) {
      this.data.set(name, new Y.Array<CRDTCompatibleObject>());
    }

    return wrap(this.data.get(name)) as YJSList<T>;
  }

  transact<T>(callback: () => T, origin?: unknown): T {
    let result!: T;
    this.doc.transact(() => {
      result = callback();
    }, origin);
    return result;
  }
}

export class YJSMap<T extends { [key: string]: CRDTCompatibleObject }> implements CRDTMap<T> {
  private emitter = new EventEmitter<CRDTMapEvents<T[string]>>();
  private initial: Map<string, T[string]> | undefined;

  readonly delegate: Y.Map<T>;

  readonly factory = new YJSFactory();

  constructor(delegate?: Y.Map<T>) {
    // This means the map is disconnected, and thus we temporarily keep values
    // in a separate storage (this.initial) in addition to the YJS Map
    if (!delegate) this.initial = new Map<string, T[string]>();

    this.delegate = delegate ?? new Y.Map();

    this.delegate.observe(e => {
      if (!shouldEmitObservableTransactionEvents(e.transaction)) return;

      this.initial = undefined;

      this.emitter.emit('remoteBeforeTransaction', {});

      e.changes.keys.forEach((change, key) => {
        if (change.action === 'add') {
          this.emitter.emit('remoteInsert', {
            key,
            value: wrap(this.get(key))
          });
        } else if (change.action === 'update') {
          this.emitter.emit('remoteUpdate', {
            key,
            value: wrap(this.get(key))
          });
        } else if (change.action === 'delete') {
          this.emitter.emit('remoteDelete', {
            key,
            value: wrap(change.oldValue)
          });
        }
      });

      this.emitter.emit('remoteAfterTransaction', {});
    });
  }

  clone() {
    // biome-ignore lint/suspicious/noExplicitAny: false positive
    const dest = new YJSMap<any>();
    for (const [key, value] of this.entries()) {
      if (value instanceof YJSMap) {
        dest.set(key, value.clone());
      } else if (value instanceof YJSList) {
        dest.set(key, value.clone());
      } else {
        dest.set(key, value);
      }
    }
    return dest;
  }

  transact<T>(callback: () => T, origin?: unknown): T {
    if (!this.delegate.doc) {
      return callback();
    } else {
      let result!: T;
      this.delegate.doc.transact(() => {
        result = callback();
      }, origin);
      return result;
    }
  }

  clear() {
    this.initial?.clear();
    withActiveUndoOrigin(this.delegate.doc, () => this.delegate.clear());
  }

  delete<K extends keyof T & string>(key: K) {
    this.initial?.delete(key);
    withActiveUndoOrigin(this.delegate.doc, () => this.delegate.delete(key));
  }

  // biome-ignore lint/suspicious/noExplicitAny: false positive
  get<K extends keyof T & string>(key: K, factory?: () => T[K]): any {
    if (this.initial) {
      if (!this.initial.has(key) && factory !== undefined) {
        this.set(key, factory());
      }
      return this.initial.get(key) ?? undefined;
    }

    if (!this.delegate.has(key) && factory !== undefined) {
      this.set(key, factory());
    }
    return wrap(this.delegate.get(key));
  }

  has<K extends keyof T & string>(key: K) {
    return this.initial?.has(key) ?? this.delegate.has(key);
  }

  set<K extends keyof T & string>(key: K, value: T[K]) {
    this.initial?.set(key, value);
    withActiveUndoOrigin(this.delegate.doc, () => this.delegate.set(key, unwrap(value)));
  }

  get size() {
    return this.initial?.size ?? this.delegate.size;
  }

  entries(): Iterable<[string, T[string]]> {
    if (this.initial) return this.initial.entries();

    const delegate = this.delegate;
    return {
      [Symbol.iterator]() {
        return mapIterator<[string, T], [string, T]>(delegate.entries(), ([k, v]) => [k, wrap(v)]);
      }
    } as Iterable<[string, T[string]]>;
  }

  keys() {
    return this.initial?.keys() ?? this.delegate.keys();
  }

  values() {
    if (this.initial) return this.initial.values();

    const delegate = this.delegate;
    return {
      [Symbol.iterator]() {
        return mapIterator<T, T>(delegate.values(), wrap);
      }
    } as Iterable<T[string]>;
  }

  on<K extends EventKey<CRDTMapEvents<T[string]>>>(
    eventName: K,
    fn: EventReceiver<CRDTMapEvents<T[string]>[K]>
  ) {
    return this.emitter.on(eventName, fn);
  }

  off<K extends EventKey<CRDTMapEvents<T[string]>>>(
    eventName: K,
    fn: EventReceiver<CRDTMapEvents<T[string]>[K]>
  ) {
    this.emitter.off(eventName, fn);
  }
}

export class YJSList<T extends CRDTCompatibleObject> implements CRDTList<T> {
  private emitter = new EventEmitter<CRDTListEvents<T>>();
  private initial: T[] | undefined;

  delegate: Y.Array<T>;

  readonly factory = new YJSFactory();

  constructor(delegate?: Y.Array<T>) {
    // This means the array is disconnected, and thus we temporarily keep values
    // in a separate storage (this.initial) in addition to the YJS List
    if (!delegate) this.initial = [];

    this.delegate = delegate ?? new Y.Array();

    this.delegate.observe(e => {
      const shouldEmitEvents = shouldEmitObservableTransactionEvents(e.transaction);
      this.initial = undefined;

      let idx = 0;

      if (shouldEmitEvents) this.emitter.emit('remoteBeforeTransaction', {});

      for (const delta of e.changes.delta) {
        if (delta.delete !== undefined) {
          if (shouldEmitEvents) {
            this.emitter.emit('remoteDelete', {
              index: idx,
              count: delta.delete
            });
          }
        } else if (delta.retain !== undefined) {
          idx += delta.retain;
        } else if (delta.insert !== undefined) {
          if (shouldEmitEvents) {
            this.emitter.emit('remoteInsert', {
              index: idx,
              // biome-ignore lint/suspicious/noExplicitAny: false positive
              value: (delta.insert as any[]).map(wrap)
            });
          }
          idx += delta.insert.length;
        }
      }

      if (shouldEmitEvents) this.emitter.emit('remoteAfterTransaction', {});
    });
  }

  clone() {
    // biome-ignore lint/suspicious/noExplicitAny: false positive
    const dest = new YJSList<any>();
    for (let i = 0; i < this.length; i++) {
      const value = this.get(i);
      if (value instanceof YJSMap) {
        dest.push(value.clone());
      } else if (value instanceof YJSList) {
        dest.push(value.clone());
      } else {
        dest.push(value);
      }
    }
    return dest;
  }

  transact<T>(callback: () => T, origin?: unknown): T {
    if (!this.delegate.doc) {
      return callback();
    } else {
      let result!: T;
      this.delegate.doc.transact(() => {
        result = callback();
      }, origin);
      return result;
    }
  }

  clear() {
    if (this.initial) {
      this.initial.length = 0;
    }
    withActiveUndoOrigin(this.delegate.doc, () => {
      while (this.delegate.length > 0) {
        this.delegate.delete(0);
      }
    });
  }

  get length() {
    return this.initial ? this.initial.length : this.delegate.length;
  }

  get(index: number): T {
    if (this.initial) {
      return this.initial[index]!;
    }
    return wrap(this.delegate.get(index));
  }

  insert(index: number, value: T[]): void {
    if (this.initial) {
      this.initial.splice(index, 0, ...value);
      return;
    }
    withActiveUndoOrigin(this.delegate.doc, () => this.delegate.insert(index, value.map(unwrap)));
  }

  push(value: T): void {
    if (this.initial) {
      this.initial.push(value);
    }
    withActiveUndoOrigin(this.delegate.doc, () => this.delegate.push([unwrap(value)]));
  }

  delete(index: number): void {
    if (this.initial) {
      this.initial.splice(index, 1);
    }
    withActiveUndoOrigin(this.delegate.doc, () => this.delegate.delete(index));
  }

  toArray(): T[] {
    return this.initial ? this.initial : this.delegate.toArray().map(wrap);
  }

  on<K extends EventKey<CRDTListEvents<T>>>(eventName: K, fn: EventReceiver<CRDTListEvents<T>[K]>) {
    return this.emitter.on(eventName, fn);
  }

  off<K extends EventKey<CRDTListEvents<T>>>(
    eventName: K,
    fn: EventReceiver<CRDTListEvents<T>[K]>
  ) {
    this.emitter.off(eventName, fn);
  }
}
