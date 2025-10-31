import { DataSchema } from './diagramDocumentDataSchemas';
import { Emitter } from '@diagram-craft/utils/event';

/**
 * Provides read-only access to data schemas.
 */
export interface SchemaProvider {
  readonly schemas: ReadonlyArray<DataSchema>;
}

/**
 * MExtends SchemaProvider with methods to add, update, and delete schemas.
 */
export interface MutableSchemaProvider extends SchemaProvider {
  addSchema(schema: DataSchema): Promise<void>;
  updateSchema(schema: DataSchema): Promise<void>;
  deleteSchema(schema: DataSchema): Promise<void>;
}

/**
 * Represents a data record with string key-value pairs and a unique identifier.
 */
export type Data = Record<string, string> & { _uid: string };

export type DataProviderEventMap = {
  deleteData: { data: Data[] };
  updateData: { data: Data[] };
  addData: { data: Data[] };

  deleteSchema: DataSchema;
  updateSchema: DataSchema;
  addSchema: DataSchema;
};

/**
 * Core interface for data providers that manage data and schemas.
 * Combines schema access with event emission and data retrieval capabilities.
 */
export interface DataProvider extends SchemaProvider, Emitter<DataProviderEventMap> {
  /** Unique identifier for the provider type (e.g., 'rest', 'url', 'default') */
  providerId: string;
  /** Unique identifier for this specific provider instance */
  id: string;
  /** Whether this provider supports undo/redo operations */
  supportsUndo: boolean;

  /** Retrieves data records by their unique identifiers */
  getById(id: Array<string>): Data[];
  /** Retrieves all data for a given schema */
  getData(schema: DataSchema): Array<Data>;
  /** Queries data for a schema using a search string */
  queryData(schema: DataSchema, query: string): Array<Data>;

  /** Serializes the provider configuration to a string */
  serialize(): string;
  /** Verifies the provider settings are valid, returns error message if invalid */
  verifySettings(): Promise<string | undefined>;
}

/**
 * Extends DataProvider with methods to add, update, and delete data records.
 */
export interface MutableDataProvider extends DataProvider {
  addData(schema: DataSchema, data: Data): Promise<void>;
  deleteData(schema: DataSchema, data: Data): Promise<void>;
  updateData(schema: DataSchema, data: Data): Promise<void>;
}

/**
 * Extends DataProvider with the ability to refresh data from the source.
 */
export interface RefreshableDataProvider extends DataProvider {
  refreshData(): Promise<void>;
}

/**
 * Extends SchemaProvider with the ability to refresh schemas from the source.
 */
export interface RefreshableSchemaProvider extends SchemaProvider {
  refreshSchemas(): Promise<void>;
}

/**
 * Global registry for data provider factory functions.
 * Maps provider type identifiers to factory functions that create provider instances.
 *
 * @namespace
 */
export const DataProviderRegistry = {
  providers: new Map<string, (s: string) => DataProvider>(),

  /**
   * Registers a data provider factory function.
   * @param type - The unique provider type identifier
   * @param provider - Factory function that creates a provider from a serialized string
   */
  register(type: string, provider: (s: string) => DataProvider) {
    this.providers.set(type, provider);
  },

  /**
   * Retrieves a registered data provider factory.
   * @param type - The provider type identifier
   * @returns The factory function if found, undefined otherwise
   */
  get(type: string) {
    return this.providers.get(type);
  }
};

/**
 * Query helper for filtering data records.
 * Performs case-sensitive substring matching across all data fields.
 */
export class DataProviderQuery {
  private readonly query: string;

  /**
   * Creates a new query instance.
   * @param s - The search string to match against data values
   */
  constructor(s: string) {
    this.query = s;
  }

  /**
   * Tests whether a data record matches the query.
   * Returns true if any field value contains the query string.
   * @param d - The data record to test
   * @returns True if the query matches any field value
   */
  matches(d: Data) {
    return Object.values(d).some(s => (s ?? '').toString().includes(this.query));
  }
}

/**
 * Type guard to check if a provider implements MutableSchemaProvider.
 * @param provider - The data provider to check
 * @returns True if the provider supports schema mutations
 */
export const isMutableSchemaProvider = (
  provider: DataProvider
): provider is DataProvider & MutableSchemaProvider => {
  return 'addSchema' in provider && 'updateSchema' in provider && 'deleteSchema' in provider;
};

/**
 * Type guard to check if a provider implements MutableDataProvider.
 * @param provider - The data provider to check
 * @returns True if the provider supports data mutations
 */
export const isMutableDataProvider = (
  provider: DataProvider
): provider is DataProvider & MutableDataProvider => {
  return 'addData' in provider && 'updateData' in provider && 'deleteData' in provider;
};
