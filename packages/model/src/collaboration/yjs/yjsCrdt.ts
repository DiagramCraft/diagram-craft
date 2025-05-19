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
}
