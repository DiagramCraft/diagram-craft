import { randomUUID } from 'node:crypto';
import type { DatabaseAdapter } from '../../db/database';
import type { StagedStorageMutation, StorageAdapter } from '../../storage/storage.types';
import { createLogger } from '../../utils/logger';

const logger = createLogger('content-write');

export type ContentWriteStage = {
  name: 'preview' | 'references' | 'revision' | 'audit' | 'cleanup';
  run(): Promise<void>;
};

export type ContentStorageChange =
  | { type: 'write'; workspace: string; storageId: string; nodeId: string; content: Buffer }
  | { type: 'delete'; workspace: string; storageId: string; nodeId: string };

type ContentWriteOptions<T> = {
  db: DatabaseAdapter;
  storage?: StorageAdapter;
  operation: string;
  scope: string;
  nodeIds: readonly string[];
  storageChanges?: readonly ContentStorageChange[];
  writeDatabase(db: DatabaseAdapter): Promise<T>;
  afterCommit?: readonly ContentWriteStage[];
};

const errorDetails = (error: unknown) =>
  error instanceof Error
    ? { name: error.name, message: error.message }
    : { message: String(error) };

const reportFailure = (
  level: 'warn' | 'error',
  message: string,
  context: Record<string, unknown>,
  error: unknown
) => logger[level](message, { ...context, error: errorDetails(error) });

const stageStorageChange = async (
  storage: StorageAdapter,
  change: ContentStorageChange
): Promise<StagedStorageMutation> => {
  if (change.type === 'write') {
    if (storage.stageWrite)
      return storage.stageWrite(change.workspace, change.storageId, change.nodeId, change.content);
    return {
      commit: () =>
        storage.write(change.workspace, change.storageId, change.nodeId, change.content),
      rollback: async () => {},
      finalize: async () => {}
    };
  }
  if (storage.stageDelete) {
    return storage.stageDelete(change.workspace, change.storageId, change.nodeId);
  }
  return {
    commit: () => storage.delete(change.workspace, change.storageId, change.nodeId),
    rollback: async () => {},
    finalize: async () => {}
  };
};

export const coordinateContentWrite = async <T>(options: ContentWriteOptions<T>): Promise<T> => {
  const operationId = randomUUID();
  const context = {
    operationId,
    operation: options.operation,
    scope: options.scope,
    nodeIds: options.nodeIds
  };
  const staged: StagedStorageMutation[] = [];

  try {
    for (const change of options.storageChanges ?? []) {
      if (!options.storage) throw new Error('Storage adapter is required for storage changes');
      staged.push(await stageStorageChange(options.storage, change));
    }
    for (const mutation of staged) await mutation.commit();
  } catch (error) {
    for (const mutation of staged.reverse()) {
      try {
        await mutation.rollback();
      } catch (compensationError) {
        reportFailure('error', 'Storage compensation failed', context, compensationError);
      }
    }
    reportFailure('error', 'Storage staging failed', context, error);
    throw error;
  }

  let result: T;
  try {
    result = options.db.core?.transaction
      ? await options.db.core.transaction(options.writeDatabase)
      : await options.writeDatabase(options.db);
  } catch (error) {
    for (const mutation of staged.reverse()) {
      try {
        await mutation.rollback();
      } catch (compensationError) {
        reportFailure(
          'error',
          'Storage compensation failed after database rollback',
          context,
          compensationError
        );
      }
    }
    reportFailure('error', 'Database transaction failed', context, error);
    throw error;
  }

  for (const mutation of staged) {
    try {
      await mutation.finalize();
    } catch (error) {
      reportFailure('warn', 'Storage cleanup failed', { ...context, stage: 'cleanup' }, error);
    }
  }
  for (const stage of options.afterCommit ?? []) {
    try {
      await stage.run();
    } catch (error) {
      reportFailure(
        'warn',
        'Best-effort content stage failed',
        { ...context, stage: stage.name },
        error
      );
    }
  }

  return result;
};
