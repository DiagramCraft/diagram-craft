/**
 * A change that has been staged but is not yet visible to readers.
 *
 * Lifecycle: `commit()` makes the change visible. After that, exactly one of `rollback()` or
 * `finalize()` ends the operation.
 */
export interface StagedStorageMutation {
  /** Publishes the staged change. Readers see the new state only after this resolves. */
  commit(): Promise<void>;
  /**
   * Restores the state from before the operation: the previous bytes are restored, and a file
   * that did not exist before is removed again. Safe to retry. Must not be called after
   * `finalize()`.
   */
  rollback(): Promise<void>;
  /** Discards the recovery data (backups). Safe to retry. After this, rollback is impossible. */
  finalize(): Promise<void>;
}

/**
 * Recovery operations, applied after a crash using only the persisted operation description.
 * Both are idempotent and safe to retry. `commit` is intentionally not offered: publishing is
 * only done by the live writer.
 */
export type StorageReconciliationAction = 'rollback' | 'finalize';

export type StorageReconciliationOperation = {
  operationId: string;
  action: 'write' | 'delete';
  workspace: string;
  scopeId: string;
  nodeId: string;
};

export interface StorageAdapter {
  read(workspace: string, scopeId: string, nodeId: string): Promise<Buffer>;
  exists(workspace: string, scopeId: string, nodeId: string): Promise<boolean>;
  write(workspace: string, scopeId: string, nodeId: string, content: Buffer): Promise<void>;
  delete(workspace: string, scopeId: string, nodeId: string): Promise<void>;
  deleteAll(workspace: string, scopeId: string): Promise<void>;
  stageWrite(
    workspace: string,
    scopeId: string,
    nodeId: string,
    content: Buffer,
    operationId?: string
  ): Promise<StagedStorageMutation>;
  stageDelete(
    workspace: string,
    scopeId: string,
    nodeId: string,
    operationId?: string
  ): Promise<StagedStorageMutation>;
  reconcile?(
    operation: StorageReconciliationOperation,
    action: StorageReconciliationAction
  ): Promise<void>;
}

/** A storage adapter that can recover interrupted operations; required by the recovery job. */
export type RecoverableStorageAdapter = StorageAdapter &
  Required<Pick<StorageAdapter, 'reconcile'>>;
