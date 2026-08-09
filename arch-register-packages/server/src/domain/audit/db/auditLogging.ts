import { randomUUID } from 'node:crypto';
import type { AuditEntityType, AuditOperation } from './auditDatabase';
import type { DatabaseAdapter } from '../../../db/database';
import { createLogger } from '../../../utils/logger';
import { enqueueOneOffJobRun } from '../../jobs/jobOperations';
import { AUDIT_FANOUT_JOB_TYPE } from '../auditFanoutJob';

// Keep the existing import path stable for the many callers that import
// flattenEntityAuditFields from here.
// biome-ignore lint/performance/noBarrelFile: compatibility re-export, see auditFieldFlattening.ts
export { flattenEntityAuditFields } from './auditFieldFlattening';

const logger = createLogger('audit');

type AuditLogParams = {
  workspace: string;
  userId: string;
  userDisplayName?: string | null;
  watcherUserIds?: string[];
  operation: AuditOperation;
  entityType: AuditEntityType;
  entityId: string;
  entityName: string;
  entitySlug?: string | null;
  schemaId?: string | null;
  changes: {
    old?: Record<string, unknown>;
    new?: Record<string, unknown>;
  };
  metadata?: Record<string, unknown>;
};

/**
 * Records an audit log entry for a mutation operation.
 */
export const logAudit = async (db: DatabaseAdapter, params: AuditLogParams): Promise<void> => {
  try {
    await writeAudit(db, params);
  } catch (error) {
    logger.error(
      'Failed to write audit log',
      error instanceof Error ? error : new Error(String(error))
    );
    throw error;
  }
};

/** Writes an audit entry and surfaces failures to coordinators that can report them with context. */
export const writeAudit = async (db: DatabaseAdapter, params: AuditLogParams): Promise<void> => {
  const writeInTransaction = async (tx: DatabaseAdapter) => {
    const {
      workspace,
      userId = null,
      watcherUserIds,
      operation,
      entityType,
      entityId,
      entityName,
      entitySlug = null,
      schemaId = null,
      changes,
      metadata = {}
    } = params;

    let resolvedWatcherUserIds = watcherUserIds;
    if (
      resolvedWatcherUserIds === undefined &&
      operation === 'delete' &&
      entityType === 'relation' &&
      typeof tx.watch?.listWatcherUserIdsForEntities === 'function'
    ) {
      const relation = metadata['relation'];
      const endpointIds =
        typeof relation === 'object' && relation != null
          ? [
              (relation as { in?: { id?: unknown } }).in?.id,
              (relation as { out?: { id?: unknown } }).out?.id
            ].filter((id): id is string => typeof id === 'string')
          : [];
      const watcherRows = await tx.watch.listWatcherUserIdsForEntities(workspace, endpointIds);
      resolvedWatcherUserIds = [...new Set(watcherRows.map(row => row.user_id))];
    }

    const auditLog = await tx.audit.createAuditLog({
      workspace,
      timestamp: new Date(),
      user_id: userId,
      operation,
      entity_type: entityType,
      entity_id: entityId,
      entity_name: entityName,
      entity_slug: entitySlug,
      schema_id: schemaId,
      changes,
      metadata
    });

    if (
      (entityType === 'entity' || entityType === 'relation') &&
      typeof tx.jobs?.enqueueOneOffRun === 'function'
    ) {
      await enqueueOneOffJobRun(tx, {
        id: randomUUID(),
        workspace,
        jobType: AUDIT_FANOUT_JOB_TYPE,
        systemIdentity: 'audit',
        payload: {
          auditLogId: auditLog.id,
          ...(resolvedWatcherUserIds
            ? { watcherUserIds: [...new Set(resolvedWatcherUserIds)] }
            : {})
        },
        maxAttempts: 5,
        dedupeKey: `audit-fanout:${auditLog.id}`
      });
    }
  };

  // Some focused unit tests provide only the domain adapters they exercise.
  // Real database adapters always expose core.transaction, while these
  // partial doubles should retain the direct-write behavior.
  if (!db.core?.transaction || db.core.isTransaction) {
    await writeInTransaction(db);
  } else {
    await db.core.transaction(writeInTransaction);
  }
};

/**
 * Helper to compute field-level changes between old and new objects.
 * Returns only fields that changed.
 */
export const computeChanges = (
  oldData: Record<string, unknown>,
  newData: Record<string, unknown>,
  options: { alwaysInclude?: string[] } = {}
): { old: Record<string, unknown>; new: Record<string, unknown> } => {
  const old: Record<string, unknown> = {};
  const newChanges: Record<string, unknown> = {};

  // Find changed and removed fields
  for (const [key, oldValue] of Object.entries(oldData)) {
    const newValue = newData[key];
    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      old[key] = oldValue;
      newChanges[key] = newValue;
    }
  }

  // Find added fields
  for (const [key, newValue] of Object.entries(newData)) {
    if (!(key in oldData)) {
      old[key] = undefined;
      newChanges[key] = newValue;
    }
  }

  for (const key of options.alwaysInclude ?? []) {
    if (!(key in oldData) || !(key in newData)) continue;
    old[key] = oldData[key];
    newChanges[key] = newData[key];
  }

  return { old, new: newChanges };
};

/**
 * Helper to extract relevant fields from an entity for audit logging.
 * Excludes internal fields like id, created_at, updated_at.
 */
export const extractEntityFields = (entity: Record<string, unknown>): Record<string, unknown> => {
  const { id, created_at, updated_at, ...rest } = entity;
  return rest;
};
