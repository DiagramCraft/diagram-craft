import {
  Data,
  DataProviderEventMap,
  DataProviderQuery,
  MutableDataProvider,
  MutableSchemaProvider
} from './dataProvider';
import { DataSchema } from './diagramDocumentDataSchemas';
import { EventEmitter } from '@diagram-craft/utils/event';

type DataWithSchema = Data & { _schemaId: string };

export const DefaultDataProviderId = 'defaultDataProvider';

export class DefaultDataProvider
  extends EventEmitter<DataProviderEventMap>
  implements MutableDataProvider, MutableSchemaProvider
{
  id = DefaultDataProviderId;

  schemas: DataSchema[];
  private data: DataWithSchema[] = [];

  constructor(s: string) {
    super();

    const d = JSON.parse(s);
    this.schemas = d.schemas ?? [];
    this.data = d.data ?? [];
  }

  async verifySettings(): Promise<string | undefined> {
    return undefined;
  }

  getById(ids: Array<string>): Data[] {
    return this.data.filter(data => ids.includes(data._uid));
  }

  getData(schema: DataSchema): Array<Data> {
    return this.data.filter(data => data._schemaId === schema.id);
  }

  queryData(schema: DataSchema, query: string): Array<Data> {
    const q = new DataProviderQuery(query);
    return this.data.filter(data => data._schemaId === schema.id && q.matches(data));
  }

  addData(schema: DataSchema, data: Data) {
    this.data.push({ ...data, _schemaId: schema.id });
    this.emit('addData', { data: [data] });
  }

  deleteData(schema: DataSchema, data: Data) {
    const idx = this.data.findIndex(d => d._schemaId === schema.id && d._uid == data._uid);
    if (idx < 0) return;
    this.data.splice(idx, 1);

    this.emit('deleteData', { data: [data] });
  }

  updateData(schema: DataSchema, data: Data) {
    const idx = this.data.findIndex(d => d._schemaId === schema.id && d._uid == data._uid);
    if (idx < 0) return;
    this.data.splice(idx, 1);

    this.data.push({ ...data, _schemaId: schema.id });
    this.emit('updateData', { data: [data] });
  }

  updateSchema(schema: DataSchema) {
    const idx = this.schemas.findIndex(s => s.id === schema.id);
    if (idx < 0) return;
    this.schemas[idx] = schema;
  }

  deleteSchema(schema: DataSchema) {
    const idx = this.schemas.findIndex(s => s.id === schema.id);
    if (idx < 0) return;

    this.schemas.splice(idx, 1);
  }

  serialize(): string {
    return JSON.stringify({
      schema: this.schemas,
      data: this.data
    });
  }
}
