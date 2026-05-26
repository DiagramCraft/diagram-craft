export interface StorageAdapter {
  read(workspace: string, projectId: string, path: string): Promise<Buffer>;
  write(workspace: string, projectId: string, path: string, content: Buffer): Promise<void>;
  delete(workspace: string, projectId: string, path: string): Promise<void>;
  deleteAll(workspace: string, projectId: string): Promise<void>;
  exists(workspace: string, projectId: string, path: string): Promise<boolean>;
}
