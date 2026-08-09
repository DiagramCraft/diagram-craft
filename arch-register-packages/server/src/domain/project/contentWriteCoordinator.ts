import { randomUUID } from 'node:crypto';
import type { DatabaseAdapter } from '../../db/database';
import type { StagedStorageMutation, StorageAdapter } from '../../storage/storage.types';
import { createLogger } from '../../utils/logger';
import type { ContentReconciliationOperation } from './db/contentReconciliationDatabase';

const logger = createLogger('content-write');

export type ContentWriteStage = {
  name: 'preview' | 'references' | 'revision' | 'audit' | 'cleanup';
  run(db: DatabaseAdapter): Promise<void>;
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

const errorDetails = (error: unknown): Record<string, unknown> => {
  if (!(error instanceof Error)) return { message: String(error) };
  const details: Record<string, unknown> = { name: error.name, message: error.message };
  if ('code' in error) details.code = (error as { code: unknown }).code;
  if ('details' in error) details.details = (error as { details: unknown }).details;
  if (error.cause) details.cause = errorDetails(error.cause);
  return details;
};

const reportFailure = (
  level: 'warn' | 'error',
  message: string,
  context: Record<string, unknown>,
  error: unknown
) => logger[level](message, { ...context, error: errorDetails(error) });

const stageStorageChange = async (
  storage: StorageAdapter,
  change: ContentStorageChange,
  operationId: string
): Promise<StagedStorageMutation> => {
  if (change.type === 'write') {
    if (typeof storage.stageWrite === 'function') {
      return storage.stageWrite(
        change.workspace,
        change.storageId,
        change.nodeId,
        change.content,
        operationId
      );
    }
    return {
      commit: () =>
        storage.write(change.workspace, change.storageId, change.nodeId, change.content),
      rollback: async () => undefined,
      finalize: async () => undefined
    };
  }
  if (typeof storage.stageDelete === 'function') {
    return storage.stageDelete(change.workspace, change.storageId, change.nodeId, operationId);
  }
  return {
    commit: () => storage.delete(change.workspace, change.storageId, change.nodeId),
    rollback: async () => undefined,
    finalize: async () => undefined
  };
};

type ReconciliationPayload = {
  storageChanges: Array<{
    operationId: string;
    action: 'write' | 'delete';
    workspace: string;
    projectId: string;
    fileId: string;
  }>;
  stages: string[];
  committed: boolean;
  finalized: boolean;
  completedStages: string[];
};

const reconciliationAdapter = (db: DatabaseAdapter) =>
  (db as DatabaseAdapter & { contentReconciliation?: typeof db.contentReconciliation })
    .contentReconciliation;

const updateLedger = async (
  db: DatabaseAdapter,
  operation: ContentReconciliationOperation | null,
  payload: ReconciliationPayload,
  update: Parameters<NonNullable<DatabaseAdapter['contentReconciliation']>['updateOperation']>[1]
) => {
  if (!operation || !reconciliationAdapter(db)) return operation;
  return reconciliationAdapter(db)!.updateOperation(operation.id, {
    ...update,
    payload
  });
};

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

export const coordinateContentWrite = async <T>(options: ContentWriteOptions<T>): Promise<T> => {
  const operationId = randomUUID();
  const context = {
    operationId,
    operation: options.operation,
    scope: options.scope,
    nodeIds: options.nodeIds
  };
  const staged: StagedStorageMutation[] = [];
  const payload: ReconciliationPayload = {
    storageChanges: (options.storageChanges ?? []).map(change => ({
      operationId,
      action: change.type,
      workspace: change.workspace,
      projectId: change.storageId,
      fileId: change.nodeId
    })),
    stages: (options.afterCommit ?? []).map(stage => stage.name),
    committed: false,
    finalized: false,
    completedStages: []
  };
  let finalizeFailed = false;
  let ledger: ContentReconciliationOperation | null = null;
  const reconciliation = reconciliationAdapter(options.db);
  const ledgerWorkspace = options.storageChanges?.[0]?.workspace;

  if (reconciliation && ledgerWorkspace) {
    ledger = await reconciliation.createOperation({
      id: operationId,
      workspace: ledgerWorkspace,
      operation: options.operation,
      scope: options.scope,
      node_ids: [...options.nodeIds],
      payload,
      next_attempt_at: new Date(),
      created_at: new Date()
    });
  }

  try {
    for (const change of options.storageChanges ?? []) {
      if (!options.storage) throw new Error('Storage adapter is required for storage changes');
      staged.push(await stageStorageChange(options.storage, change, operationId));
    }
    for (const mutation of staged) await mutation.commit();
  } catch (error) {
    for (const mutation of [...staged].reverse()) {
      try {
        await mutation.rollback();
      } catch (compensationError) {
        reportFailure('error', 'Storage compensation failed', context, compensationError);
      }
    }
    if (ledger && reconciliation) {
      await updateLedger(options.db, ledger, payload, {
        state: 'pending',
        last_error: errorMessage(error),
        attempt_count: ledger.attempt_count + 1,
        next_attempt_at: new Date(Date.now() + 60_000),
        updated_at: new Date()
      });
    }
    reportFailure('error', 'Storage staging failed', context, error);
    throw error;
  }

  let result: T;
  const writeAndAudit = async (transactionDb: DatabaseAdapter) => {
    const transactionResult = await options.writeDatabase(transactionDb);
    for (const stage of options.afterCommit ?? []) {
      if (stage.name === 'audit') {
        await stage.run(transactionDb);
        payload.completedStages.push(stage.name);
      }
    }
    return transactionResult;
  };
  try {
    result = options.db.core?.transaction
      ? await options.db.core.transaction(async tx => {
          const transactionResult = await writeAndAudit(tx);
          payload.committed = true;
          if (reconciliation) {
            await tx.contentReconciliation.updateOperation(operationId, {
              state: 'database_committed',
              payload,
              last_error: null,
              updated_at: new Date()
            });
          }
          return transactionResult;
        })
      : await writeAndAudit(options.db);
  } catch (error) {
    for (const mutation of [...staged].reverse()) {
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
    if (ledger && reconciliation) {
      await updateLedger(options.db, ledger, payload, {
        state: 'pending',
        last_error: errorMessage(error),
        attempt_count: ledger.attempt_count + 1,
        next_attempt_at: new Date(Date.now() + 60_000),
        updated_at: new Date()
      });
    }
    reportFailure('error', 'Database transaction failed', context, error);
    throw error;
  }

  for (const mutation of staged) {
    try {
      await mutation.finalize();
    } catch (error) {
      finalizeFailed = true;
      reportFailure('warn', 'Storage cleanup failed', { ...context, stage: 'cleanup' }, error);
      if (ledger && reconciliation) {
        await updateLedger(options.db, ledger, payload, {
          state: 'resolving',
          last_error: errorMessage(error),
          next_attempt_at: new Date(Date.now() + 60_000),
          updated_at: new Date()
        });
      }
    }
  }
  payload.finalized = !finalizeFailed;
  for (const stage of (options.afterCommit ?? []).filter(stage => stage.name !== 'audit')) {
    try {
      await stage.run(options.db);
      payload.completedStages.push(stage.name);
    } catch (error) {
      reportFailure(
        'warn',
        'Best-effort content stage failed',
        { ...context, stage: stage.name },
        error
      );
      if (ledger && reconciliation) {
        await updateLedger(options.db, ledger, payload, {
          state: 'failed',
          last_error: `${stage.name}: ${errorMessage(error)}`,
          attempt_count: ledger.attempt_count + 1,
          next_attempt_at: new Date(Date.now() + 60_000),
          updated_at: new Date()
        });
      }
    }
  }

  if (
    ledger &&
    reconciliation &&
    payload.finalized &&
    payload.completedStages.length === payload.stages.length
  ) {
    await updateLedger(options.db, ledger, payload, {
      state: 'resolved',
      last_error: null,
      resolved_at: new Date(),
      updated_at: new Date()
    });
  }

  return result;
};
