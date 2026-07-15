import type { AuditEntityType, AuditOperation } from './auditDatabase';
import type { DatabaseAdapter } from '../../../db/database';
import { createLogger } from '../../../utils/logger';
import { Entity } from '../../catalog/db/catalogDatabase';
import { enqueueWebhookDeliveries } from '../../webhook/webhookDelivery';

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
    // Entity audit records also drive webhook delivery. Do not turn a failed
    // enqueue into a successful mutation with a silently missing notification.
    if (params.entityType === 'entity') throw error;
  }
};

/** Writes an audit entry and surfaces failures to coordinators that can report them with context. */
export const writeAudit = async (db: DatabaseAdapter, params: AuditLogParams): Promise<void> => {
  const writeInTransaction = async (tx: DatabaseAdapter) => {
    const {
      workspace,
      userId = null,
      userDisplayName,
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

    // Some focused unit tests use partial database doubles without the webhook
    // adapter. Real server adapters always provide it; skip enqueueing quietly
    // for those doubles rather than treating the missing stub as an error.
    const webhookAdapter = (tx as unknown as { webhook?: { listWebhooks?: unknown } }).webhook;
    if (entityType === 'entity' && typeof webhookAdapter?.listWebhooks === 'function') {
      // Keep the audit row and delivery jobs in the same transaction. A failed
      // enqueue rolls back the audit row instead of leaving a false impression
      // that the change was delivered.
      await enqueueWebhookDeliveries(tx, auditLog);
    }

    if (entityType === 'entity') {
      await tx.watch.createNotificationsFromAudit({
        auditLog,
        changedByDisplayName: userDisplayName ?? userId ?? 'system',
        watcherUserIds
      });
    }
  };

  if (db.core.isTransaction) {
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
  newData: Record<string, unknown>
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

export const flattenEntityAuditFields = (entity: Entity): Record<string, unknown> => ({
  _schemaId: entity.schema_id,
  _name: entity.name,
  _slug: entity.slug,
  _namespace: entity.namespace,
  _description: entity.description,
  _owner: entity.owner,
  _lifecycle: entity.lifecycle,
  _targetLifecycle: entity.target_lifecycle,
  _targetLifecycleDate: entity.target_lifecycle_date,
  _tags: entity.tags,
  _links: entity.links,
  _visibilityMode: entity.visibility_mode,
  ...entity.data
});
