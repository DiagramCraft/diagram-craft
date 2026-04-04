import type { DataSchema, DataWithSchema } from './types';

export interface ModelServer {
  getAllData(): DataWithSchema[];
  getDataById(id: string): DataWithSchema | undefined;
  addData(data: DataWithSchema): DataWithSchema;
  updateData(id: string, data: DataWithSchema): DataWithSchema | null;
  deleteData(id: string): boolean;
  getAllSchemas(): DataSchema[];
  getSchemaById(id: string): DataSchema | undefined;
  addSchema(schema: DataSchema): DataSchema;
  updateSchema(id: string, schema: DataSchema): DataSchema | null;
  deleteSchema(id: string): boolean;
  bootstrap?(args: { dataFile: string; schemasFile: string }): void;
}
