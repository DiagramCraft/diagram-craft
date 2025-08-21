import * as fs from 'node:fs';
import * as path from 'node:path';
import { DataSchema, DataWithSchema } from './types';

const newid = () => {
  return Math.random().toString(36).substring(2, 9);
};

export class FileSystemDataStore {
  private dataFile: string;
  private schemasFile: string;
  private data: DataWithSchema[] = [];
  private schemas: DataSchema[] = [];

  constructor(dataDir: string) {
    this.dataFile = path.join(dataDir, 'data.json');
    this.schemasFile = path.join(dataDir, 'schemas.json');

    // Ensure data directory exists
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    this.loadData();
  }

  private loadData(): void {
    try {
      if (fs.existsSync(this.dataFile)) {
        const dataContent = fs.readFileSync(this.dataFile, 'utf-8');
        this.data = JSON.parse(dataContent);
      }
    } catch (error) {
      console.warn('Failed to load data file:', error);
      this.data = [];
    }

    try {
      if (fs.existsSync(this.schemasFile)) {
        const schemasContent = fs.readFileSync(this.schemasFile, 'utf-8');
        this.schemas = JSON.parse(schemasContent);
      }
    } catch (error) {
      console.warn('Failed to load schemas file:', error);
      this.schemas = [];
    }
  }

  private saveData(): void {
    try {
      fs.writeFileSync(this.dataFile, JSON.stringify(this.data, null, 2));
    } catch (error) {
      console.error('Failed to save data file:', error);
      throw new Error('Failed to save data');
    }
  }

  private saveSchemas(): void {
    try {
      fs.writeFileSync(this.schemasFile, JSON.stringify(this.schemas, null, 2));
    } catch (error) {
      console.error('Failed to save schemas file:', error);
      throw new Error('Failed to save schemas');
    }
  }

  // Data operations
  getAllData(): DataWithSchema[] {
    return [...this.data];
  }

  getDataById(id: string): DataWithSchema | undefined {
    return this.data.find(item => item._uid === id);
  }

  addData(data: DataWithSchema): DataWithSchema {
    // Generate a new UID if not provided or if it already exists
    if (!data._uid || this.data.some(item => item._uid === data._uid)) {
      data._uid = newid();
    }

    this.data.push(data);
    this.saveData();
    return data;
  }

  updateData(id: string, updatedData: DataWithSchema): DataWithSchema | null {
    const index = this.data.findIndex(item => item._uid === id);
    if (index === -1) {
      return null;
    }

    // Preserve the original UID
    updatedData._uid = id;
    this.data[index] = updatedData;
    this.saveData();
    return updatedData;
  }

  deleteData(id: string): boolean {
    const index = this.data.findIndex(item => item._uid === id);
    if (index === -1) {
      return false;
    }

    this.data.splice(index, 1);
    this.saveData();
    return true;
  }

  // Schema operations
  getAllSchemas(): DataSchema[] {
    return [...this.schemas];
  }

  getSchemaById(id: string): DataSchema | undefined {
    return this.schemas.find(schema => schema.id === id);
  }

  addSchema(schema: DataSchema): DataSchema {
    // Check if schema with this ID already exists
    if (this.schemas.some(s => s.id === schema.id)) {
      throw new Error(`Schema with ID '${schema.id}' already exists`);
    }

    this.schemas.push(schema);
    this.saveSchemas();
    return schema;
  }

  updateSchema(id: string, updatedSchema: DataSchema): DataSchema | null {
    const index = this.schemas.findIndex(schema => schema.id === id);
    if (index === -1) {
      return null;
    }

    // Preserve the original ID
    updatedSchema.id = id;
    this.schemas[index] = updatedSchema;
    this.saveSchemas();
    return updatedSchema;
  }

  deleteSchema(id: string): boolean {
    const index = this.schemas.findIndex(schema => schema.id === id);
    if (index === -1) {
      return false;
    }

    this.schemas.splice(index, 1);
    this.saveSchemas();
    return true;
  }

  // Bootstrap data from external files
  bootstrapFromFiles(dataFilePath: string, schemasFilePath: string): void {
    try {
      if (fs.existsSync(dataFilePath)) {
        const dataContent = fs.readFileSync(dataFilePath, 'utf-8');
        this.data = JSON.parse(dataContent);
        this.saveData();
        console.log(`Bootstrapped data from: ${dataFilePath}`);
      }
    } catch (error) {
      throw new Error(`Failed to bootstrap data from ${dataFilePath}`);
    }

    try {
      if (fs.existsSync(schemasFilePath)) {
        const schemasContent = fs.readFileSync(schemasFilePath, 'utf-8');
        this.schemas = JSON.parse(schemasContent);
        this.saveSchemas();
        console.log(`Bootstrapped schemas from: ${schemasFilePath}`);
      }
    } catch (error) {
      throw new Error(`Failed to bootstrap schemas from ${schemasFilePath}`);
    }
  }
}
