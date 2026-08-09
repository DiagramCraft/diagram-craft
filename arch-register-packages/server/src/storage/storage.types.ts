export interface StagedStorageMutation {
  commit(): Promise<void>;
  rollback(): Promise<void>;
  finalize(): Promise<void>;
}

export type StorageReconciliationAction = 'commit' | 'rollback' | 'finalize';

export type StorageReconciliationOperation = {
  operationId: string;
  action: 'write' | 'delete';
  workspace: string;
  projectId: string;
  fileId: string;
};

export interface StorageAdapter {
  read(workspace: string, projectId: string, fileId: string): Promise<Buffer>;
  write(workspace: string, projectId: string, fileId: string, content: Buffer): Promise<void>;
  delete(workspace: string, projectId: string, fileId: string): Promise<void>;
  deleteAll(workspace: string, projectId: string): Promise<void>;
  stageWrite(
    workspace: string,
    projectId: string,
    fileId: string,
    content: Buffer,
    operationId?: string
  ): Promise<StagedStorageMutation>;
  stageDelete(
    workspace: string,
    projectId: string,
    fileId: string,
    operationId?: string
  ): Promise<StagedStorageMutation>;
  reconcile?(
    operation: StorageReconciliationOperation,
    action: StorageReconciliationAction
  ): Promise<void>;
}
