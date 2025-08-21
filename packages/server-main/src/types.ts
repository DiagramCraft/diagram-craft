// Local type definitions for the REST API server
// These are copies of types from @diagram-craft/model to keep the server decoupled

export type Data = Record<string, string> & { _uid: string };

export type DataSchemaField = {
  id: string;
  name: string;
  type: 'text' | 'longtext';
};

export type DataSchema = {
  id: string;
  name: string;
  source: 'document' | 'external';
  fields: DataSchemaField[];
};

export type DataWithSchema = Data & { _schemaId: string };