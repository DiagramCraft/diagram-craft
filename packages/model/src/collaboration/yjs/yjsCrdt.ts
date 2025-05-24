import { CRDTListEvents, CRDTRoot } from '../crdt';
import * as Y from 'yjs';
import { EventEmitter, EventKey, EventReceiver } from '@diagram-craft/utils/event';

export class YJSRoot implements CRDTRoot {
  private readonly doc = new Y.Doc();

  constructor() {}

  get yDoc() {
    return this.doc;
  }

  getMap(name: string) {
    return this.doc.getMap(name);
  }

  getList(name: string) {
    return this.doc.get(name, YJSList);
  }

  transact(callback: () => void) {
    this.doc.transact(callback);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class YJSMap extends Y.Map<any> {}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class YJSList extends Y.Array<any> {
  private emitter = new EventEmitter<CRDTListEvents>();

  constructor() {
    super();

    this.observe(e => {
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
            value: delta.insert as any[]
          });
          idx += delta.insert.length;
        }
      }
    });
  }

  on<K extends EventKey<CRDTListEvents>>(eventName: K, fn: EventReceiver<CRDTListEvents[K]>) {
    this.emitter.on(eventName, fn);
  }

  off<K extends EventKey<CRDTListEvents>>(eventName: K, fn: EventReceiver<CRDTListEvents[K]>) {
    this.emitter.off(eventName, fn);
  }
}
