export interface StorageAdapter {
  read(workspace: string, projectId: string, fileId: string): Promise<Buffer>;
  write(workspace: string, projectId: string, fileId: string, content: Buffer): Promise<void>;
  delete(workspace: string, projectId: string, fileId: string): Promise<void>;
  deleteAll(workspace: string, projectId: string): Promise<void>;
}
