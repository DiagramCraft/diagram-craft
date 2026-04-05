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
  getTempPath(name: string): string;
}
