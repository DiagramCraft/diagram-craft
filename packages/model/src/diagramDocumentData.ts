import {
  Data,
  DataProvider,
  type DataProviderEventMap,
  DataProviderRegistry,
  isMutableDataProvider,
  isMutableSchemaProvider,
  type MutableDataProvider,
  type RefreshableDataProvider,
  type RefreshableSchemaProvider
} from './dataProvider';
import { DataSchema, DiagramDocumentDataSchemas } from './diagramDocumentDataSchemas';
import type { DiagramDocument } from './diagramDocument';
import { DiagramDocumentDataTemplates } from './diagramDocumentDataTemplates';
import { UnitOfWork } from './unitOfWork';
import { deepEquals } from '@diagram-craft/utils/object';
import { EventEmitter, type EventKey, type EventReceiver } from '@diagram-craft/utils/event';
import { CRDTMap, CRDTMapEvents, CRDTRoot } from './collaboration/crdt';
import { assert, VerifyNotReached } from '@diagram-craft/utils/assert';
import { DefaultDataProvider, DefaultDataProviderId } from './dataProviderDefault';

const makeDataListener =
  (document: DiagramDocument, mode: 'update' | 'delete') => (data: { data: Data[] }) => {
    for (const d of document.diagramIterator({ nest: true })) {
      const uow = new UnitOfWork(d);
      for (const e of d.allElements()) {
        const externalData = e.metadata.data?.data?.filter(d => d.type === 'external') ?? [];
        if (externalData.length === 0) continue;

        for (const dt of data.data) {
          const predicate = (e: ElementDataEntry) => e.external?.uid === dt._uid;

          const existing = externalData.find(predicate);
          if (!existing) continue;

          if (mode === 'update') {
            if (deepEquals<unknown>(existing, dt)) continue;

            e.updateMetadata(cb => {
              cb.data!.data!.find(predicate)!.data = dt;
            }, uow);
          } else {
            e.updateMetadata(cb => {
              cb.data ??= {};
              cb.data!.data = cb.data?.data?.filter(dt => !predicate(dt));
            }, uow);
          }
        }
      }
      uow.commit();
    }
  };

const makeDeleteSchemaListener = (document: DiagramDocument) => (s: DataSchema) => {
  document.data._schemas.removeAndClearUsage(s, UnitOfWork.immediate(document.diagrams[0]));
};

const makeUpdateSchemaListener = (document: DiagramDocument) => (s: DataSchema) => {
  const schemas = document.data._schemas;
  if (schemas.has(s.id)) {
    if (deepEquals(schemas.get(s.id), s)) return;
    schemas.update(s);
  } else {
    schemas.add(s);
  }
};

// TODO: To be loaded from file
const DEFAULT_SCHEMA: DataSchema[] = [
  {
    id: 'default',
    name: 'Default',
    providerId: 'document',
    fields: [
      {
        id: 'name',
        name: 'Name',
        type: 'text'
      },
      {
        id: 'notes',
        name: 'Notes',
        type: 'longtext'
      }
    ]
  }
];

export class DiagramDocumentData extends EventEmitter<{ change: void }> {
  // Shared properties
  readonly #schemas: DiagramDocumentDataSchemas;
  readonly #templates: DiagramDocumentDataTemplates;

  // Transient properties
  #providers: Array<DataProvider> = [];
  readonly #crdt: CRDTMap<Record<string, string>>;

  readonly #updateDataListener: (data: { data: Data[] }) => void;
  readonly #deleteDataListener: (data: { data: Data[] }) => void;
  readonly #deleteSchemaListener: (s: DataSchema) => void;
  readonly #updateSchemaListener: (s: DataSchema) => void;

  constructor(root: CRDTRoot, document: DiagramDocument) {
    super();

    this.#crdt = root.getMap('documentData');
    this.#schemas = new DiagramDocumentDataSchemas(root, document, DEFAULT_SCHEMA);
    this.#templates = new DiagramDocumentDataTemplates(root);

    this.#updateDataListener = makeDataListener(document, 'update');
    this.#deleteDataListener = makeDataListener(document, 'delete');
    this.#deleteSchemaListener = makeDeleteSchemaListener(document);
    this.#updateSchemaListener = makeUpdateSchemaListener(document);

    this.#schemas.on('add', () => this.emit('change'));
    this.#schemas.on('remove', () => this.emit('change'));
    this.#schemas.on('update', () => this.emit('change'));
    this.#templates.on('add', () => this.emit('change'));
    this.#templates.on('remove', () => this.emit('change'));
    this.#templates.on('update', () => this.emit('change'));

    const updateProvider = (e: CRDTMapEvents['remoteUpdate'] | CRDTMapEvents['remoteInsert']) => {
      if (e.key !== 'provider') return;
      if (e.value.length === 0) {
        this.setProviderInternal([]);
      } else {
        const entries = JSON.parse(e.value) as Array<{ id: string; data: string }>;
        this.setProviderInternal(
          entries.map(({ id, data }) => DataProviderRegistry.providers.get(id)!(data))
        );
      }
    };

    this.#crdt.on('remoteUpdate', updateProvider);
    this.#crdt.on('remoteInsert', updateProvider);
  }

  private setProviderInternal(dataProviders: Array<DataProvider>, initial = false) {
    this.#providers?.forEach(p => p?.off?.('addData', this.#updateDataListener));
    this.#providers?.forEach(p => p?.off?.('updateData', this.#updateDataListener));
    this.#providers?.forEach(p => p?.off?.('deleteData', this.#deleteDataListener));
    this.#providers?.forEach(p => p?.off?.('addSchema', this.#updateSchemaListener));
    this.#providers?.forEach(p => p?.off?.('updateSchema', this.#updateSchemaListener));
    this.#providers?.forEach(p => p?.off?.('deleteSchema', this.#deleteSchemaListener));

    this.#providers = dataProviders;
    if (!initial) this.emit('change');

    this.#providers.forEach(p => p.on('addData', this.#updateDataListener));
    this.#providers.forEach(p => p.on('updateData', this.#updateDataListener));
    this.#providers.forEach(p => p.on('deleteData', this.#deleteDataListener));
    this.#providers.forEach(p => p.on('addSchema', this.#updateSchemaListener));
    this.#providers.forEach(p => p.on('updateSchema', this.#updateSchemaListener));
    this.#providers.forEach(p => p.on('deleteSchema', this.#deleteSchemaListener));
  }

  setProviders(dataProviders: Array<DataProvider>, initial = false) {
    if (dataProviders[0]?.id !== DefaultDataProviderId) {
      dataProviders.unshift(
        new DefaultDataProvider(`{ "schemas": ${JSON.stringify(DEFAULT_SCHEMA)} }`)
      );
    }

    this.setProviderInternal(dataProviders, initial);

    this.#crdt.set(
      'provider',
      this.#providers
        ? JSON.stringify(this.#providers.map(p => ({ id: p.id, data: p.serialize() })))
        : ''
    );
  }

  get providers() {
    return this.#providers;
  }

  get _schemas() {
    return this.#schemas;
  }

  get templates() {
    return this.#templates;
  }

  get db() {
    return new DataManager(this.#providers);
  }
}

export class DataManager extends EventEmitter<DataProviderEventMap> {
  private provider: DataProvider;

  constructor(providers: Array<DataProvider>) {
    super();
    this.provider = providers[0];
  }

  isMutable() {
    return isMutableDataProvider(this.provider!);
  }

  isMutableSchema() {
    return isMutableSchemaProvider(this.provider!);
  }

  refreshData() {
    return (this.provider as RefreshableDataProvider).refreshData();
  }

  refreshSchemas() {
    return (this.provider as unknown as RefreshableSchemaProvider).refreshSchemas();
  }

  getSchema(schema: string) {
    const r = this.schemas.find(s => s.id === schema);
    assert.present(r);
    return r;
  }

  findSchemaByName(name: string): DataSchema | undefined {
    return this.schemas.find(s => s.name === name);
  }

  addSchema(schema: DataSchema) {
    if (!isMutableSchemaProvider(this.provider!)) throw new VerifyNotReached();
    return this.provider.addSchema(schema);
  }

  updateSchema(schema: DataSchema) {
    if (!isMutableSchemaProvider(this.provider!)) throw new VerifyNotReached();
    return this.provider.updateSchema(schema);
  }

  deleteSchema(schema: DataSchema) {
    if (!isMutableSchemaProvider(this.provider!)) throw new VerifyNotReached();
    return this.provider.deleteSchema(schema);
  }

  getData(schema: DataSchema) {
    return this.provider?.getData(schema) ?? [];
  }

  get schemas() {
    return this.provider?.schemas ?? [];
  }

  getById(_schema: DataSchema, ids: string[]) {
    return this.provider?.getById(ids) ?? [];
  }

  queryData(schema: DataSchema, query: string) {
    return this.provider?.queryData(schema, query);
  }

  deleteData(schema: DataSchema, data: Data) {
    return (this.provider as MutableDataProvider)?.deleteData(schema, data);
  }

  updateData(schema: DataSchema, data: Data) {
    return (this.provider as MutableDataProvider)?.updateData(schema, data);
  }

  addData(schema: DataSchema, data: Data) {
    return (this.provider as MutableDataProvider)?.addData(schema, data);
  }

  on<K extends EventKey<DataProviderEventMap>>(
    eventName: K,
    fn: EventReceiver<DataProviderEventMap[K]>,
    id?: string
  ) {
    this.provider?.on(eventName, fn, id);
  }

  off<K extends EventKey<DataProviderEventMap>>(
    eventName: K,
    fnOrId: EventReceiver<DataProviderEventMap[K]> | string
  ) {
    this.provider?.off(eventName, fnOrId);
  }
}
