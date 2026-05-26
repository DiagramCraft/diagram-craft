import sql from './client.js';
import type { AuditOperation, AuditEntityType } from '../types.js';

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
export const logAudit = async (params: AuditLogParams): Promise<void> => {
  const {
    workspace,
    operation,
    entityType,
    entityId,
    entityName,
    entitySlug = null,
    schemaId = null,
    changes,
    metadata = {},
  } = params;

  try {
    await sql`
      INSERT INTO audit_log (
        workspace,
        user_id,
        operation,
        entity_type,
        entity_id,
        entity_name,
        entity_slug,
        schema_id,
        changes,
        metadata
      ) VALUES (
        ${workspace},
        ${STATIC_USER},
        ${operation},
        ${entityType},
        ${entityId},
        ${entityName},
        ${entitySlug},
        ${schemaId},
        ${sql.json(changes as Parameters<typeof sql.json>[0])},
        ${sql.json(metadata as Parameters<typeof sql.json>[0])}
      )
    `;
  } catch (error) {
    // Log error but don't fail the main operation
    console.error('Failed to write audit log:', error);
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
