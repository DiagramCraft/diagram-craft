import type { AuditOperation, AuditEntityType } from '../types.js';
import type { DatabaseAdapter } from './database.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('audit');

const STATIC_USER = 'system'; // Until authentication is implemented

type AuditLogParams = {
  workspace: string;
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
    await db.audit.createAuditLog({
      workspace,
      timestamp: new Date(),
      user_id: STATIC_USER,
      operation,
      entity_type: entityType,
      entity_id: entityId,
      entity_name: entityName,
      entity_slug: entitySlug,
      schema_id: schemaId,
      changes,
      metadata
    });
  } catch (error) {
    // Log error but don't fail the main operation
    logger.error('Failed to write audit log', error instanceof Error ? error : new Error(String(error)));
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