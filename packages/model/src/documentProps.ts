import type { DiagramDocument } from './diagramDocument';
import type { EmptyObject } from '@diagram-craft/utils/types';
import { EventEmitter } from '@diagram-craft/utils/event';
import type { CRDTList, CRDTRoot } from '@diagram-craft/collaboration/crdt';
import type { Releasable } from '@diagram-craft/utils/releasable';

export type QueryType = 'advanced' | 'simple' | 'djql';

type StoredType = [QueryType, string, string, string];

export type QueryEntry = {
  type: QueryType;
  label: string;
  scope: string;
  value: string;
};

class Query extends EventEmitter<{ change: EmptyObject }> {
  private _history: CRDTList<StoredType>;
  private _saved: CRDTList<StoredType>;

  constructor(
    private readonly root: CRDTRoot,
    private readonly document: DiagramDocument
  ) {
    super();

    this._history = root.getList('query.history');
    this._saved = root.getList('query.saved');

    if (this._history.length === 0) {
      this._history.push(['djql', '.elements[]', 'active-layer', '.elements[]']);
      this._history.push([
        'djql',
        '.elements[] | select(.edges | length > 0)',
        'active-layer',
        '.elements[] | select(.edges | length > 0)'
      ]);
    }
  }

  get history(): Array<QueryEntry> {
    return this._history.toArray().map(e => {
      return {
        type: e[0],
        label: e[1],
        scope: e[2],
        value: e[3]
      };
    });
  }

  addHistory(type: QueryType, label: string, scope: string, value: string) {
    const entry: StoredType = [type, label, scope, value];
    this.document.root.transact(() => {
      this._history.insert(0, [entry]);

      for (let i = 1; i < this._history.length; i++) {
        const [a, b, c, d] = this._history.get(i);
        if (a === entry[0] && b === entry[1] && c === entry[2] && d === entry[3]) {
          this._history.delete(i);
          i--;
        }
      }
    });
    this.emitAsync('change');
  }

  setHistory(entries: ReadonlyArray<QueryEntry>) {
    this.root.transact(() => {
      this._history.clear();
      for (const e of entries) {
        this.addHistory(e.type, e.label, e.scope, e.value);
      }
    });
    this.emitAsync('change');
  }

  get saved(): Array<QueryEntry> {
    return this._saved.toArray().map(e => {
      return {
        type: e[0],
        label: e[1],
        scope: e[2],
        value: e[3]
      };
    });
  }

  addSaved(type: QueryType, label: string, scope: string, value: string) {
    this._saved.push([type, label, scope, value]);
    this.emitAsync('change');
  }

  setSaved(entries: ReadonlyArray<QueryEntry>) {
    this._saved.clear();
    for (const e of entries) {
      this.addSaved(e.type, e.label, e.scope, e.value);
    }
  }

  removeSaved(type: QueryType, label: string, scope: string, value: string) {
    this.document.root.transact(() => {
      for (let i = 0; i < this._saved.length; i++) {
        const [a, b, c, d] = this._saved.get(i);
        if (a === type && b === label && c === scope && d === value) {
          this._saved.delete(i);
          break;
        }
      }
    });
    this.emitAsync('change');
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
export class DocumentProps implements Releasable {
  readonly query: Query;
  readonly recentStencils: RecentStencils;

  constructor(root: CRDTRoot, document: DiagramDocument) {
    this.query = new Query(root, document);
    this.recentStencils = new RecentStencils(root);
  }

  release() {}
}
