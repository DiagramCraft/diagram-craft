import { DataSchema } from './diagramDocumentDataSchemas';
import { Emitter } from '@diagram-craft/utils/event';

export interface SchemaProvider {
  readonly schemas: ReadonlyArray<DataSchema>;
}

export interface MutableSchemaProvider extends SchemaProvider {
  addSchema(schema: DataSchema): Promise<void>;
  updateSchema(schema: DataSchema): Promise<void>;
  deleteSchema(schema: DataSchema): Promise<void>;
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
  providerId: string;
  id: string;
  supportsUndo: boolean;

  getById(id: Array<string>): Data[];
  getData(schema: DataSchema): Array<Data>;
  queryData(schema: DataSchema, query: string): Array<Data>;

  serialize(): string;
  verifySettings(): Promise<string | undefined>;
}

export interface MutableDataProvider extends DataProvider {
  addData(schema: DataSchema, data: Data): Promise<void>;
  deleteData(schema: DataSchema, data: Data): Promise<void>;
  updateData(schema: DataSchema, data: Data): Promise<void>;
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
  private readonly query: string;

  constructor(s: string) {
    this.query = s;
  }

  matches(d: Data) {
    return Object.values(d).some(s => (s ?? '').toString().includes(this.query));
  }
}

export const isMutableSchemaProvider = (
  provider: DataProvider
): provider is DataProvider & MutableSchemaProvider => {
  return 'addSchema' in provider && 'updateSchema' in provider && 'deleteSchema' in provider;
};

export const isMutableDataProvider = (
  provider: DataProvider
): provider is DataProvider & MutableDataProvider => {
  return 'addData' in provider && 'updateData' in provider && 'deleteData' in provider;
};
