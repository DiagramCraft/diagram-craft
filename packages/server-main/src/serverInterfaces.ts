import type { createServer } from 'node:http';
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

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIGenerateRequest {
  messages: AIMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
}

export type AIStreamResult = {
  type: 'stream';
  body: ReadableStream<Uint8Array>;
};

export type AIJsonResult = {
  type: 'json';
  body: unknown;
};

export type AIResult = AIStreamResult | AIJsonResult;

export interface AIServer {
  generate(request: AIGenerateRequest): Promise<AIResult>;
}

export type FileSystemFileResult = {
  type: 'file';
  path: string;
  size: number;
  modifiedAt: number;
  contentType: string;
};

export type FileSystemDirectoryResult = {
  type: 'directory';
  entries: Array<{
    name: string;
    isDirectory: boolean;
  }>;
};

export type FileSystemGetResult = FileSystemFileResult | FileSystemDirectoryResult;

export type FileSystemWriteRequest = {
  contentType?: string;
  contentLength?: number;
  body?: string | Buffer;
};

export type FileSystemPutResult = {
  status: 'ok';
};

export interface FileSystemServer {
  get(path: string): Promise<FileSystemGetResult>;
  put(path: string, request: FileSystemWriteRequest): Promise<FileSystemPutResult>;
}

export interface CollaborationServer {
  bind(server: ReturnType<typeof createServer>): void;
  close(): Promise<void>;
}
