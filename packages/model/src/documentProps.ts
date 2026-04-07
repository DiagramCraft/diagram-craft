import type { DiagramDocument } from './diagramDocument';
import type { EmptyObject } from '@diagram-craft/utils/types';
import { EventEmitter } from '@diagram-craft/utils/event';
import type { CRDTList, CRDTMap, CRDTRoot } from '@diagram-craft/collaboration/crdt';
import type { Releasable } from '@diagram-craft/utils/releasable';
import { isEmptyString } from '@diagram-craft/utils/strings';

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
        '.elements[] | select(.nodeType=="rect")',
        'active-layer',
        '.elements[]'
      ]);
      this._history.push([
        'djql',
        '.elements[] | select(.edges | length > 0)',
        'active-layer',
        '.elements[] | select(.edges | length > 0)'
      ]);
    }
  }

  get history(): Array<QueryEntry> {
    return this._history
      .toArray()
      .filter(e => !isEmptyString(e[3]))
      .map(e => {
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

class RecentItems {
  #items: CRDTList<string>;

  constructor(root: CRDTRoot, key: string) {
    this.#items = root.getList(key);
  }

  register(id: string) {
    if (!this.#items.toArray().includes(id)) {
      this.#items.insert(0, [id]);
    }
    while (this.#items.length > MAX_LENGTH) {
      this.#items.delete(this.items.length - 1);
    }
  }

  set(items: readonly string[]) {
    this.#items.clear();
    for (const item of items.toReversed()) {
      this.register(item);
    }
  }

  get items() {
    return this.#items.toArray();
  }
}

class RecentStencils extends RecentItems {
  constructor(root: CRDTRoot) {
    super(root, 'recentStencils');
  }

  get stencils() {
    return this.items;
  }
}

class RecentEdgeStylesheets extends RecentItems {
  constructor(root: CRDTRoot) {
    super(root, 'recentEdgeStylesheets');
  }

  get stylesheets() {
    return this.items;
  }
}

class ActiveStencilPackages extends EventEmitter<{ change: EmptyObject }> {
  #items: CRDTList<string>;
  #meta: CRDTMap<{ initialized: boolean }>;

  constructor(root: CRDTRoot) {
    super();
    this.#items = root.getList<string>('activeStencilPackages');
    this.#meta = root.getMap('activeStencilPackagesMeta');
  }

  get ids() {
    return this.#items.toArray();
  }

  get isInitialized() {
    return this.#meta.get('initialized') ?? false;
  }

  has(id: string) {
    return this.ids.includes(id);
  }

  set(ids: readonly string[]) {
    this.#items.clear();
    for (const id of ids) {
      if (this.#items.toArray().includes(id)) continue;
      this.#items.push(id);
    }
    this.#meta.set('initialized', true);
    this.emitAsync('change');
  }

  add(id: string) {
    if (this.has(id)) return;
    this.#items.push(id);
    this.#meta.set('initialized', true);
    this.emitAsync('change');
  }

  remove(id: string) {
    for (let i = 0; i < this.#items.length; i++) {
      if (this.#items.get(i) !== id) continue;
      this.#items.delete(i);
      break;
    }
    this.#meta.set('initialized', true);
    this.emitAsync('change');
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
  readonly recentEdgeStylesheets: RecentEdgeStylesheets;
  readonly activeStencilPackages: ActiveStencilPackages;

  constructor(root: CRDTRoot, document: DiagramDocument) {
    this.query = new Query(root, document);
    this.recentStencils = new RecentStencils(root);
    this.recentEdgeStylesheets = new RecentEdgeStylesheets(root);
    this.activeStencilPackages = new ActiveStencilPackages(root);
  }

  release() {}
}
