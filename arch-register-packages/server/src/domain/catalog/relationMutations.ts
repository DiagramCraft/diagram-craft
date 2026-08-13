import { randomUUID } from 'node:crypto';
import type { DatabaseAdapter } from '../../db/database';
import type { RelationDbCreate, RelationDbResult, RelationDbUpdate } from './db/relationDatabase';
import type { EntityVersionKind } from './db/catalogDatabase';
import { logAudit, computeChanges } from '../audit/db/auditLogging';
import {
  flattenRelationAuditFields,
  relationAuditContext,
  relationToBaseState,
  assertTypedRelationCardinality
} from './relationHelpers';
import { assertCatalogMutationTransaction } from './mutationTransaction';
import { recalculateEntityDerivedFields } from '../derived/derivedRecalculation';
import { assertEntityGraphValid, validateEntityGraph } from './entityValidationRules';

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
  skipTypedRelationCardinalityValidation?: boolean;
};

type UpdateRelationWithAuditParams = {
  workspace: string;
  relationId: string;
  previous: RelationDbResult;
  next: RelationDbUpdate;
  actor: RelationMutationActor;
  auditMetadata?: Record<string, unknown>;
  versionKind?: EntityVersionKind;
  commitMessage?: string | null;
  appliedCaseRevisionId?: string | null;
};

type DeleteRelationWithAuditParams = {
  workspace: string;
  relation: RelationDbResult;
  actor: RelationMutationActor;
  versionNumber: number;
  auditMetadata?: Record<string, unknown>;
  skipTypedRelationCardinalityValidation?: boolean;
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
  assertCatalogMutationTransaction(db);
  if (!params.skipTypedRelationCardinalityValidation) {
    await assertTypedRelationCardinality(db, params.workspace, [
      {
        relationSchemaId: params.relation.schema_id,
        inEntityId: params.relation.in_entity_id,
        outEntityId: params.relation.out_entity_id,
        delta: 1
      }
    ]);
  }
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
  await recalculateEntityDerivedFields(db, params.workspace, [row.in_entity_id, row.out_entity_id]);
  const validation = await validateEntityGraph(db, params.workspace, [
    row.in_entity_id,
    row.out_entity_id
  ]);
  assertEntityGraphValid(validation);

  return {
    ...row,
    ...(validation.relationResults.find(result => result.relationId === row.id)
      ? { validation: validation.relationResults.find(result => result.relationId === row.id) }
      : {})
  };
};

export const deleteRelationWithAudit = async (
  db: DatabaseAdapter,
  params: DeleteRelationWithAuditParams
): Promise<RelationDbResult | null> => {
  assertCatalogMutationTransaction(db);
  if (!params.skipTypedRelationCardinalityValidation) {
    await assertTypedRelationCardinality(db, params.workspace, [
      {
        relationSchemaId: params.relation.schema_id,
        inEntityId: params.relation.in_entity_id,
        outEntityId: params.relation.out_entity_id,
        delta: -1
      }
    ]);
  }
  const deleted = await db.relation.deleteRelation(params.workspace, params.relation.id);
  if (deleted == null) return null;

  await db.catalog.createEntityVersion({
    id: randomUUID(),
    workspace: params.workspace,
    record_id: params.relation.id,
    version_number: params.versionNumber,
    kind: 'deleted',
    commit_message: null,
    created_at: new Date(),
    created_by: params.actor.id,
    state: relationToBaseState(params.relation),
    applied_case_revision_id: null
  });

  await logAudit(db, {
    userId: params.actor.id,
    userDisplayName: params.actor.displayName ?? null,
    workspace: params.workspace,
    operation: 'delete',
    entityType: 'relation',
    entityId: params.relation.id,
    entityName: `${params.relation.in_entity_name} → ${params.relation.out_entity_name}`,
    schemaId: params.relation.schema_id,
    changes: { old: flattenRelationAuditFields(params.relation) },
    metadata: { relation: relationAuditContext(params.relation), ...params.auditMetadata }
  });

  await recalculateEntityDerivedFields(db, params.workspace, [
    params.relation.in_entity_id,
    params.relation.out_entity_id
  ]);
  const validation = await validateEntityGraph(db, params.workspace, [
    params.relation.in_entity_id,
    params.relation.out_entity_id
  ]);
  assertEntityGraphValid(validation);

  return deleted;
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
  assertCatalogMutationTransaction(db);
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
    kind: params.versionKind ?? 'autosave',
    commit_message: params.commitMessage ?? null,
    created_at: row.updated_at,
    created_by: params.actor.id,
    state: relationToBaseState(row),
    applied_case_revision_id: params.appliedCaseRevisionId ?? null
  });
  await db.catalog.pruneAutosaveVersions(params.workspace, row.id, RELATION_AUTOSAVE_KEEP_COUNT);

  await recalculateEntityDerivedFields(db, params.workspace, [
    params.previous.in_entity_id,
    params.previous.out_entity_id,
    row.in_entity_id,
    row.out_entity_id
  ]);
  const validation = await validateEntityGraph(db, params.workspace, [
    params.previous.in_entity_id,
    params.previous.out_entity_id,
    row.in_entity_id,
    row.out_entity_id
  ]);
  assertEntityGraphValid(validation);

  return {
    ...row,
    ...(validation.relationResults.find(result => result.relationId === row.id)
      ? { validation: validation.relationResults.find(result => result.relationId === row.id) }
      : {})
  };
};
