export interface StagedStorageMutation {
  commit(): Promise<void>;
  rollback(): Promise<void>;
  finalize(): Promise<void>;
}

export interface StorageAdapter {
  read(workspace: string, projectId: string, fileId: string): Promise<Buffer>;
  write(workspace: string, projectId: string, fileId: string, content: Buffer): Promise<void>;
  delete(workspace: string, projectId: string, fileId: string): Promise<void>;
  deleteAll(workspace: string, projectId: string): Promise<void>;
  stageWrite(
    workspace: string,
    projectId: string,
    fileId: string,
    content: Buffer
  ): Promise<StagedStorageMutation>;
  stageDelete(
    workspace: string,
    projectId: string,
    fileId: string
  ): Promise<StagedStorageMutation>;
}
