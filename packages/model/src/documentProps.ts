import { CRDT, CRDTList, CRDTMap, CRDTProperty, CRDTRoot } from './collaboration/crdt';
import { DiagramDocument } from './diagramDocument';

class Query {
  private readonly obj: CRDTMap;

  private _history = new CRDTProperty<CRDTList<[string, string]>>('history');
  private _saved = new CRDTProperty<CRDTList<[string, string]>>('saved');

  constructor(
    parent: CRDTMap,
    private readonly document: DiagramDocument
  ) {
    this.obj = CRDT.getMap(parent, 'query');

    this._history.initialize(this.obj, new CRDT.List());
    this._saved.initialize(this.obj, new CRDT.List());

    const history = this._history.get(this.obj);
    if (history.length === 0) {
      history.push([
        ['active-layer', '.elements[]'],
        ['active-layer', '.elements[] | select(.edges | length > 0)']
      ]);
    }
  }

  get history() {
    return this._history.get(this.obj).toArray();
  }

  addHistory(entry: [string, string]) {
    this.document.transact(() => {
      const history = this._history.get(this.obj);
      history.insert(0, [entry]);

      for (let i = 1; i < history.length; i++) {
        const [k, v] = history.get(i);
        if (k === entry[0] && v === entry[1]) {
          history.delete(i);
          i--;
        }
      }
    });
  }

  setHistory(entries: ReadonlyArray<[string, string]>) {
    const list = this._history.get(this.obj);
    list.clear();
    for (const e of entries) {
      this.addHistory(e);
    }
  }

  get saved() {
    return this._saved.get(this.obj).toArray();
  }

  addSaved(entry: [string, string]) {
    this._saved.get(this.obj).push([entry]);
  }

  setSaved(entries: ReadonlyArray<[string, string]>) {
    const list = this._saved.get(this.obj);
    list.clear();
    for (const e of entries) {
      this.addSaved(e);
    }
  }
}

const MAX_LENGTH = 30;

class RecentStencils {
  #stencils: CRDTList<string>;

  constructor(parent: CRDTMap) {
    this.#stencils = CRDT.getList(parent, 'stencils');
  }

  register(id: string) {
    if (!this.#stencils.toArray().includes(id)) {
      this.#stencils.insert(0, [id]);
    }
    while (this.#stencils.length > MAX_LENGTH) {
      this.#stencils.delete(this.stencils.length - 1);
    }
  }

  set(stencils: readonly string[]) {
    this.#stencils.clear();
    for (const s of stencils) {
      this.register(s);
    }
  }

  get stencils() {
    return this.#stencils.toArray();
  }
}

/**
 * The DocumentProps allows extra application data to be stored
 * By design; changing the extra data field, the document is not to be
 * considered dirty. This must be handled manually
 */
export class DocumentProps {
  readonly query: Query;
  readonly recentStencils: RecentStencils;

  constructor(root: CRDTRoot, document: DiagramDocument) {
    this.query = new Query(root.getMap('documentProps'), document);
    this.recentStencils = new RecentStencils(root.getMap('documentProps'));
  }
}
