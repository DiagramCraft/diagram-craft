import { CRDTList, CRDTRoot } from './collaboration/crdt';
import { DiagramDocument } from './diagramDocument';

class Query {
  private _history: CRDTList<[string, string]>;
  private _saved: CRDTList<[string, string]>;

  constructor(
    root: CRDTRoot,
    private readonly document: DiagramDocument
  ) {
    this._history = root.getList('query.history');
    this._saved = root.getList('query.saved');

    if (this._history.length === 0) {
      this._history.push(['active-layer', '.elements[]']);
      this._history.push(['active-layer', '.elements[] | select(.edges | length > 0)']);
    }
  }

  get history() {
    return this._history.toArray();
  }

  addHistory(entry: [string, string]) {
    this.document.transact(() => {
      this._history.insert(0, [entry]);

      for (let i = 1; i < this._history.length; i++) {
        const [k, v] = this._history.get(i);
        if (k === entry[0] && v === entry[1]) {
          this._history.delete(i);
          i--;
        }
      }
    });
  }

  setHistory(entries: ReadonlyArray<[string, string]>) {
    this._history.clear();
    for (const e of entries) {
      this.addHistory(e);
    }
  }

  get saved() {
    return this._saved.toArray();
  }

  addSaved(entry: [string, string]) {
    this._saved.push(entry);
  }

  setSaved(entries: ReadonlyArray<[string, string]>) {
    this._saved.clear();
    for (const e of entries) {
      this.addSaved(e);
    }
  }
}

const MAX_LENGTH = 30;

class RecentStencils {
  #stencils: CRDTList<string>;

  constructor(root: CRDTRoot) {
    this.#stencils = root.getList('recentStencils');
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
    this.query = new Query(root, document);
    this.recentStencils = new RecentStencils(root);
  }
}
