import { CRDTRoot } from '../crdt';
import * as Y from 'yjs';

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
    return this.doc.getArray(name);
  }

  transact(callback: () => void) {
    this.doc.transact(callback);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class YJSMap extends Y.Map<any> {}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class YJSList extends Y.Array<any> {}
