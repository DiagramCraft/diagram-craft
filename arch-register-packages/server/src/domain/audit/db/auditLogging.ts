import type { AuditEntityType, AuditOperation } from './auditDatabase';
import type { DatabaseAdapter } from '../../../db/database';
import { createLogger } from '../../../utils/logger';
import { Entity } from '../../catalog/db/catalogDatabase';

const logger = createLogger('audit');

type AuditLogParams = {
  workspace: string;
  userId?: string | null;
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

  try {
    const auditLog = await db.audit.createAuditLog({
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

    if (entityType === 'entity') {
      await db.watch.createNotificationsFromAudit({
        auditLog,
        changedByDisplayName: userDisplayName ?? userId ?? 'system',
        watcherUserIds
      });
    }
  } catch (error) {
    // Log error but don't fail the main operation
    logger.error(
      'Failed to write audit log',
      error instanceof Error ? error : new Error(String(error))
    );
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
