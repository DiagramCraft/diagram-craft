import { randomUUID } from 'node:crypto';
import type { DatabaseAdapter } from '../../db/database';
import type { RelationDbCreate, RelationDbResult, RelationDbUpdate } from './db/relationDatabase';
import { logAudit, computeChanges } from '../audit/db/auditLogging';
import {
  flattenRelationAuditFields,
  relationAuditContext,
  relationToBaseState
} from './relationHelpers';

export const RELATION_AUTOSAVE_KEEP_COUNT = 50;

export type RelationMutationActor = {
  id: string;
  displayName?: string | null;
};

type CreateRelationWithAuditParams = {
  workspace: string;
  relation: RelationDbCreate;
  actor: RelationMutationActor;
  auditMetadata?: Record<string, unknown>;
};

type UpdateRelationWithAuditParams = {
  workspace: string;
  relationId: string;
  previous: RelationDbResult;
  next: RelationDbUpdate;
  actor: RelationMutationActor;
  auditMetadata?: Record<string, unknown>;
};

/**
 * Raw create + audit-log + version-snapshot for a relation instance, with no permission checks —
 * mirrors `createEntityWithAudit` (entityMutations.ts). Callers (`createWorkspaceRelation`,
 * `relationSyncOperations.ts`) are responsible for authorization before invoking this.
 */
export const createRelationWithAudit = async (
  db: DatabaseAdapter,
  params: CreateRelationWithAuditParams
): Promise<RelationDbResult> => {
  const row = await db.relation.createRelation(params.relation);

  await logAudit(db, {
    userId: params.actor.id,
    userDisplayName: params.actor.displayName ?? null,
    workspace: params.workspace,
    operation: 'create',
    entityType: 'relation',
    entityId: row.id,
    entityName: `${row.in_entity_name} → ${row.out_entity_name}`,
    schemaId: row.schema_id,
    changes: { new: flattenRelationAuditFields(row) },
    metadata: { relation: relationAuditContext(row), ...params.auditMetadata }
  });

  await db.catalog.createEntityVersion({
    id: randomUUID(),
    workspace: params.workspace,
    record_id: row.id,
    version_number: row.version,
    kind: 'autosave',
    commit_message: null,
    created_at: row.updated_at,
    created_by: params.actor.id,
    state: relationToBaseState(row),
    applied_case_revision_id: null
  });
  await db.catalog.pruneAutosaveVersions(params.workspace, row.id, RELATION_AUTOSAVE_KEEP_COUNT);

  return row;
};

/**
 * Raw update + audit-log + version-snapshot for a relation instance, with no permission checks —
 * mirrors `updateEntityWithAudit` (entityMutations.ts). Callers (`updateWorkspaceRelation`,
 * `relationSyncOperations.ts`) are responsible for authorization before invoking this.
 */
export const updateRelationWithAudit = async (
  db: DatabaseAdapter,
  params: UpdateRelationWithAuditParams
): Promise<RelationDbResult | null> => {
  const row = await db.relation.updateRelation(params.workspace, params.relationId, params.next);
  if (row == null) return null;

  const changes = computeChanges(
    flattenRelationAuditFields(params.previous),
    flattenRelationAuditFields(row),
    { alwaysInclude: ['_inEntityId', '_outEntityId'] }
  );
  await logAudit(db, {
    userId: params.actor.id,
    userDisplayName: params.actor.displayName ?? null,
    workspace: params.workspace,
    operation: 'update',
    entityType: 'relation',
    entityId: params.relationId,
    entityName: `${row.in_entity_name} → ${row.out_entity_name}`,
    schemaId: row.schema_id,
    changes,
    metadata: { relation: relationAuditContext(row), ...params.auditMetadata }
  });

  await db.catalog.createEntityVersion({
    id: randomUUID(),
    workspace: params.workspace,
    record_id: row.id,
    version_number: row.version,
    kind: 'autosave',
    commit_message: null,
    created_at: row.updated_at,
    created_by: params.actor.id,
    state: relationToBaseState(row),
    applied_case_revision_id: null
  });
  await db.catalog.pruneAutosaveVersions(params.workspace, row.id, RELATION_AUTOSAVE_KEEP_COUNT);

  return row;
};
