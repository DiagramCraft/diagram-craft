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

  constructor(root: CRDTRoot) {
    super();
    this.#items = root.getList<string>('activeStencilPackages');
  }

  get ids() {
    return this.#items.toArray();
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
    this.emitAsync('change');
  }

  add(id: string) {
    if (this.has(id)) return;
    this.#items.push(id);
    this.emitAsync('change');
  }

  remove(id: string) {
    for (let i = 0; i < this.#items.length; i++) {
      if (this.#items.get(i) !== id) continue;
      this.#items.delete(i);
      break;
    }
    this.emitAsync('change');
  }
}

export type DocumentMetadata = {
  title: string;
  company: string;
  category: string;
  keywords: string;
  description: string;
};

class Metadata extends EventEmitter<{ change: EmptyObject }> {
  #map: CRDTMap<DocumentMetadata>;

  constructor(root: CRDTRoot) {
    super();
    this.#map = root.getMap('metadata');
  }

  get title(): string {
    return this.#map.get('title') ?? '';
  }

  set title(value: string) {
    this.#map.set('title', value);
    this.emitAsync('change');
  }

  get company(): string {
    return this.#map.get('company') ?? '';
  }

  set company(value: string) {
    this.#map.set('company', value);
    this.emitAsync('change');
  }

  get category(): string {
    return this.#map.get('category') ?? '';
  }

  set category(value: string) {
    this.#map.set('category', value);
    this.emitAsync('change');
  }

  get keywords(): string {
    return this.#map.get('keywords') ?? '';
  }

  set keywords(value: string) {
    this.#map.set('keywords', value);
    this.emitAsync('change');
  }

  get description(): string {
    return this.#map.get('description') ?? '';
  }

  set description(value: string) {
    this.#map.set('description', value);
    this.emitAsync('change');
  }

  getAll(): DocumentMetadata {
    return {
      title: this.title,
      company: this.company,
      category: this.category,
      keywords: this.keywords,
      description: this.description
    };
  }

  setAll(metadata: Partial<DocumentMetadata>) {
    if (metadata.title !== undefined) this.title = metadata.title;
    if (metadata.company !== undefined) this.company = metadata.company;
    if (metadata.category !== undefined) this.category = metadata.category;
    if (metadata.keywords !== undefined) this.keywords = metadata.keywords;
    if (metadata.description !== undefined) this.description = metadata.description;
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
  readonly metadata: Metadata;

  constructor(root: CRDTRoot, document: DiagramDocument) {
    this.query = new Query(root, document);
    this.recentStencils = new RecentStencils(root);
    this.recentEdgeStylesheets = new RecentEdgeStylesheets(root);
    this.activeStencilPackages = new ActiveStencilPackages(root);
    this.metadata = new Metadata(root);
  }

  release() {}
}
