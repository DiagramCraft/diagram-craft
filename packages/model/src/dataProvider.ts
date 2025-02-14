import { DataSchema } from './diagramDocumentDataSchemas';
import { Emitter } from '@diagram-craft/utils/event';

export interface SchemaProvider {
  schemas: DataSchema[];
}

export interface MutableSchemaProvider extends SchemaProvider {
  updateSchema(schema: DataSchema): void;
  deleteSchema(schema: DataSchema): void;
}

export type Data = Record<string, string> & { _uid: string };

export type DataProviderEventMap = {
  deleteData: { data: Data[] };
  updateData: { data: Data[] };
  addData: { data: Data[] };

  deleteSchema: DataSchema;
  updateSchema: DataSchema;
  addSchema: DataSchema;
};

export interface DataProvider extends SchemaProvider, Emitter<DataProviderEventMap> {
  id: string;

  getById(id: Array<string>): Data[];
  getData(schema: DataSchema): Array<Data>;
  queryData(schema: DataSchema, query: string): Array<Data>;

  serialize(): string;
  verifySettings(): Promise<string | undefined>;
}

export interface MutableDataProvider extends DataProvider {
  addData(schema: DataSchema, data: Data): void;
  deleteData(schema: DataSchema, data: Data): void;
  updateData(schema: DataSchema, data: Data): void;
}

export interface RefreshableDataProvider extends DataProvider {
  refreshData(): Promise<void>;
}

export interface RefreshableSchemaProvider extends SchemaProvider {
  refreshSchemas(): Promise<void>;
}

export const DataProviderRegistry = {
  providers: new Map<string, (s: string) => DataProvider>(),

  register(type: string, provider: (s: string) => DataProvider) {
    this.providers.set(type, provider);
  },

  get(type: string) {
    return this.providers.get(type);
  }
};

export class DataProviderQuery {
  private query: string;

  constructor(s: string) {
    this.query = s;
  }

  matches(d: Data) {
    return Object.values(d).some(s => (s ?? '').toString().includes(this.query));
  }
}
