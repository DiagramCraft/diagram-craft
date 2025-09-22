import {
  Data,
  DataProvider,
  DataProviderEventMap,
  DataProviderQuery,
  RefreshableDataProvider,
  RefreshableSchemaProvider
} from './dataProvider';
import { DataSchema } from './diagramDocumentDataSchemas';
import { EventEmitter } from '@diagram-craft/utils/event';

type DataWithSchema = Data & { _schemaId: string };

export abstract class BaseHTTPDataProvider
  extends EventEmitter<DataProviderEventMap>
  implements DataProvider, RefreshableDataProvider, RefreshableSchemaProvider
{
  abstract providerId: string;
  id: string = '';

  schemas: DataSchema[] = [];
  protected data: DataWithSchema[] = [];

  protected constructor(autoRefresh = true) {
    super();

    if (autoRefresh) {
      setTimeout(() => this.initializeWithAutoRefresh(), 200);
    }
  }

  protected async initializeWithAutoRefresh(): Promise<void> {
    await this.refreshSchemas(false);
    await this.refreshData(false);
  }

  abstract verifySettings(): Promise<string | undefined>;

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

  async refreshData(force = true): Promise<void> {
    const oldDataMap = new Map();
    this.data.forEach(d => oldDataMap.set(d._uid, d));

    const newData = await this.fetchData(force);

    const newDataIds = new Set();
    newData.forEach(d => newDataIds.add(d._uid));

    const updates: Data[] = [];
    const adds: Data[] = [];
    const deletes: Data[] = [];

    this.data = [];
    for (const d of newData) {
      this.data.push(d);

      const oldEntry = oldDataMap.get(d._uid);
      if (oldEntry) {
        updates.push(d);
      } else {
        adds.push(d);
      }
    }

    for (const [oldId, oldEntry] of oldDataMap.entries()) {
      if (!newDataIds.has(oldId)) {
        deletes.push(oldEntry);
      }
    }

    this.emitAsyncWithDebounce('updateData', { data: updates });
    this.emitAsyncWithDebounce('addData', { data: adds });
    this.emitAsyncWithDebounce('deleteData', { data: deletes });
  }

  async refreshSchemas(force = true): Promise<void> {
    const oldSchemas = [...this.schemas];
    const newSchemas = await this.fetchSchemas(force);

    for (const schema of newSchemas) {
      const oldSchema = oldSchemas.find(s => s.id === schema.id);
      if (oldSchema) {
        this.emit('updateSchema', schema);
      } else {
        this.emit('addSchema', schema);
      }
    }

    for (const schema of oldSchemas) {
      if (!newSchemas.find(s => s.id === schema.id)) {
        this.emit('deleteSchema', schema);
      }
    }

    this.schemas = newSchemas;
  }

  abstract serialize(): string;

  protected abstract fetchData(force?: boolean): Promise<DataWithSchema[]>;
  protected abstract fetchSchemas(force?: boolean): Promise<DataSchema[]>;
}
