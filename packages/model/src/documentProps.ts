import { CRDT, CRDTMap, CRDTProperty, CRDTRoot } from './collaboration/crdt';
import { DiagramDocument } from './diagramDocument';

class Query {
  private readonly obj: CRDTMap;

  private _history = new CRDTProperty('history');
  private _saved = new CRDTProperty('saved');

  constructor(
    parent: CRDTMap,
    private readonly document: DiagramDocument
  ) {
    this.obj = new CRDT.Map();
    parent.set('query', this.obj);

    this._history.set(this.obj, new CRDT.List());
    this._saved.set(this.obj, new CRDT.List());

    const history = this._history.get(this.obj);
    if (history.length === 0) {
      history.push([
        ['active-layer', '.elements[]'],
        ['active-layer', '.elements[] | select(.edges | length > 0)']
      ]);
    }
  }

  get history() {
    return this._history.get(this.obj).toArray() as Array<[string, string]>;
  }

  addHistory(entry: [string, string]) {
    this.document.transact(() => {
      const history = this._history.get(this.obj);
      history.insert(0, entry);

      for (let i = 1; i < history.length; i++) {
        const [k, v] = history.get(i);
        if (k === entry[0] && v === entry[1]) {
          history.remove(i);
          i--;
        }
      }
    });
  }

  get saved() {
    return this._saved.get(this.obj).toArray() as Array<[string, string]>;
  }

  addSaved(entry: [string, string]) {
    this._saved.get(this.obj).push(entry);
  }
}

export class DocumentProps {
  readonly query: Query;

  constructor(root: CRDTRoot, document: DiagramDocument) {
    this.query = new Query(root.getMap('documentProps'), document);
  }
}
