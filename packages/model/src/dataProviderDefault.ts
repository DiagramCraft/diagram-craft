import {
  Data,
  DataProviderEventMap,
  DataProviderQuery,
  MutableDataProvider,
  MutableSchemaProvider
} from './dataProvider';
import { DataSchema } from './diagramDocumentDataSchemas';
import { EventEmitter } from '@diagram-craft/utils/event';
import { type CRDTMap, CRDTRoot } from './collaboration/crdt';
import { assert } from '@diagram-craft/utils/assert';
import { newid } from '@diagram-craft/utils/id';

type DataWithSchema = Data & { _schemaId: string };

export const DefaultDataProviderId = 'defaultDataProvider';

const DATA_DELETE = `${newid()}.d.delete`;
const DATA_INSERT = `${newid()}.d.insert`;
const DATA_UPDATE = `${newid()}.d.update`;
const SCHEMA_DELETE = `${newid()}.s.delete`;
const SCHEMA_INSERT = `${newid()}.s.insert`;
const SCHEMA_UPDATE = `${newid()}.s.update`;

export class DefaultDataProvider
  extends EventEmitter<DataProviderEventMap>
  implements MutableDataProvider, MutableSchemaProvider
{
  providerId = DefaultDataProviderId;
  id: string = 'default';
  supportsUndo = true;

  #crdtData: CRDTMap<{ [p: string]: DataWithSchema }> | undefined = undefined;
  #crdtSchemas: CRDTMap<{ [p: string]: DataSchema }> | undefined = undefined;

  #storedState:
    | {
        schemas?: Array<DataSchema>;
        data?: Array<DataWithSchema>;
      }
    | undefined = undefined;

  constructor(s: string) {
    super();

    this.#storedState = JSON.parse(s);
  }

  setCRDT(root: CRDTRoot) {
    if (this.#crdtData && this.#crdtSchemas) {
      this.#crdtData?.off?.('remoteDelete', DATA_DELETE);
      this.#crdtData?.off?.('remoteInsert', DATA_INSERT);
      this.#crdtData?.off?.('remoteUpdate', DATA_UPDATE);
      this.#crdtSchemas?.off?.('remoteDelete', SCHEMA_DELETE);
      this.#crdtSchemas?.off?.('remoteInsert', SCHEMA_INSERT);
      this.#crdtSchemas?.off?.('remoteUpdate', SCHEMA_UPDATE);
    }

    this.#crdtData = root.getMap('defaultDataProviderData');
    this.#crdtSchemas = root.getMap('defaultDataProviderSchemas');

    if (this.#storedState) {
      // Note, ignoring the promise in these cases are fine as we know the implementation
      // in DefaultDataProvider is synchronous (it's only the interface that is async)
      this.#storedState.schemas?.forEach(schema => {
        this.addSchema(schema);
      });
      this.#storedState.data?.forEach(data => {
        this.addData(this.schemas.find(s => s.id === data._schemaId)!, data);
      });
      this.#storedState = undefined;
    }

    this.#crdtData.on('remoteDelete', p => this.emitAsync('deleteData', { data: [p.value] }), {
      id: DATA_DELETE
    });
    this.#crdtData.on(
      'remoteInsert',
      p => {
        this.emitAsync('addData', { data: [p.value] });
      },
      { id: DATA_INSERT }
    );
    this.#crdtData.on(
      'remoteUpdate',
      p => {
        this.emitAsync('updateData', { data: [p.value] });
      },
      { id: DATA_UPDATE }
    );
    this.#crdtSchemas.on(
      'remoteDelete',
      p => {
        this.emitAsync('deleteSchema', { ...p.value });
      },
      { id: SCHEMA_DELETE }
    );
    this.#crdtSchemas.on(
      'remoteInsert',
      p => {
        this.emitAsync('addSchema', { ...p.value });
      },
      { id: SCHEMA_INSERT }
    );
    this.#crdtSchemas.on(
      'remoteUpdate',
      p => {
        this.emitAsync('updateSchema', { ...p.value });
      },
      { id: SCHEMA_UPDATE }
    );
  }

  get schemas(): ReadonlyArray<DataSchema> {
    return [...(this.#crdtSchemas?.values() ?? [])];
  }

  async verifySettings(): Promise<string | undefined> {
    return undefined;
  }

  getById(ids: Array<string>): Data[] {
    if (!this.#crdtData) return [];
    return [...this.#crdtData.values()].filter(data => ids.includes(data._uid));
  }

  getData(schema: DataSchema): Array<Data> {
    if (!this.#crdtData) return [];
    return [...this.#crdtData.values()].filter(data => data._schemaId === schema.id);
  }

  queryData(schema: DataSchema, query: string): Array<Data> {
    if (!this.#crdtData) return [];

    const q = new DataProviderQuery(query);
    return [...this.#crdtData.values()].filter(
      data => data._schemaId === schema.id && q.matches(data)
    );
  }

  async addData(schema: DataSchema, data: Data): Promise<void> {
    assert.present(this.#crdtData);

    this.#crdtData.set(data._uid, { ...data, _schemaId: schema.id });
    this.emit('addData', { data: [data] });
  }

  async deleteData(_schema: DataSchema, data: Data): Promise<void> {
    assert.present(this.#crdtData);

    const exists = this.#crdtData.has(data._uid);
    if (!exists) return;

    this.#crdtData.delete(data._uid);
    this.emit('deleteData', { data: [data] });
  }

  async updateData(schema: DataSchema, data: Data): Promise<void> {
    assert.present(this.#crdtData);

    const exists = this.#crdtData.has(data._uid);
    if (!exists) return;

    this.#crdtData.set(data._uid, { ...data, _schemaId: schema.id });

    this.emit('updateData', { data: [data] });
  }

  async addSchema(schema: DataSchema): Promise<void> {
    schema.providerId = this.id;

    assert.present(this.#crdtSchemas);

    this.#crdtSchemas.set(schema.id, schema);
    this.emit('addSchema', schema);
  }

  async updateSchema(schema: DataSchema): Promise<void> {
    schema.providerId = this.id;

    assert.present(this.#crdtSchemas);

    const exists = this.#crdtSchemas.has(schema.id);
    if (!exists) return;

    this.#crdtSchemas.set(schema.id, schema);
    this.emit('updateSchema', schema);
  }

  async deleteSchema(schema: DataSchema): Promise<void> {
    assert.present(this.#crdtSchemas);

    const exists = this.#crdtSchemas.has(schema.id);
    if (!exists) return;

    this.#crdtSchemas.delete(schema.id);
    this.emit('deleteSchema', schema);
  }

  serialize(): string {
    return JSON.stringify({
      schemas: this.schemas,
      data: [...(this.#crdtData?.values() ?? [])]
    });
  }
}
