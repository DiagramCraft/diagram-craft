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
  document.data.schemas.removeAndClearUsage(s, UnitOfWork.immediate(document.diagrams[0]));
};

const makeUpdateSchemaListener = (document: DiagramDocument) => (s: DataSchema) => {
  const schemas = document.data.schemas;
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
  #provider: DataProvider | undefined;
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
        this.setProviderInternal(undefined);
      } else {
        const { id, data } = JSON.parse(e.value);
        this.setProviderInternal(DataProviderRegistry.providers.get(id)!(data));
      }
    };

    this.#crdt.on('remoteUpdate', updateProvider);
    this.#crdt.on('remoteInsert', updateProvider);
  }

  private setProviderInternal(dataProvider: DataProvider | undefined, initial = false) {
    this.#provider?.off?.('addData', this.#updateDataListener);
    this.#provider?.off?.('updateData', this.#updateDataListener);
    this.#provider?.off?.('deleteData', this.#deleteDataListener);
    this.#provider?.off?.('addSchema', this.#updateSchemaListener);
    this.#provider?.off?.('updateSchema', this.#updateSchemaListener);
    this.#provider?.off?.('deleteSchema', this.#deleteSchemaListener);

    this.#provider = dataProvider;
    if (!initial) this.emit('change');

    if (this.#provider) {
      this.#provider.on('addData', this.#updateDataListener);
      this.#provider.on('updateData', this.#updateDataListener);
      this.#provider.on('deleteData', this.#deleteDataListener);
      this.#provider.on('addSchema', this.#updateSchemaListener);
      this.#provider.on('updateSchema', this.#updateSchemaListener);
      this.#provider.on('deleteSchema', this.#deleteSchemaListener);
    }
  }

  setProvider(dataProvider: DataProvider | undefined, initial = false) {
    this.setProviderInternal(dataProvider, initial);

    this.#crdt.set(
      'provider',
      this.#provider
        ? JSON.stringify({ id: this.#provider!.id, data: this.#provider!.serialize() })
        : ''
    );
  }

  get provider() {
    return this.#provider;
  }

  get schemas() {
    return this.#schemas;
  }

  get templates() {
    return this.#templates;
  }

  get db() {
    return new DataManager(this.#provider);
  }
}

export class DataManager extends EventEmitter<DataProviderEventMap> {
  constructor(private readonly provider: DataProvider | undefined) {
    super();
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
