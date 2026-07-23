import type { EntityDbCreate, DatabaseAdapter, EntityDbUpdate } from '../../db/database';
import { computeChanges, flattenEntityAuditFields, logAudit } from '../audit/db/auditLogging';
import { Entity, EntityVersionKind } from './db/catalogDatabase';
import { outdateExternalMetadata, valueEquals } from '../externalMetadata/externalMetadataHelpers';

const AUTOSAVE_KEEP_COUNT = 50;

export const entityToBaseState = (row: Entity): Record<string, unknown> => ({
  id: row.id,
  workspace: row.workspace,
  public_id: row.public_id,
  slug: row.slug,
  namespace: row.namespace,
  name: row.name,
  description: row.description,
  owner: row.owner,
  lifecycle: row.lifecycle,
  target_lifecycle: row.target_lifecycle,
  target_lifecycle_date: row.target_lifecycle_date,
  tags: row.tags,
  links: row.links,
  schema_id: row.schema_id,
  data: row.data,
  project_id: row.project_id,
  version: row.version ?? 1,
  // Frozen at the time this version was written — see computeEntityCompleteness callers in
  // entityMutationOperations.ts. Intentionally never recomputed against a later schema edit, so
  // historical versions keep reading the score as it was when the entity looked that way (#2346).
  completeness: row.completeness,
  created_at: row.created_at,
  updated_at: row.updated_at
});

export type EntityMutationActor = {
  id: string;
  displayName: string | null;
};

type CreateEntityWithAuditParams = {
  workspace: string;
  entity: EntityDbCreate;
  actor: EntityMutationActor;
};

type UpdateEntityWithAuditParams = {
  workspace: string;
  entityId: string;
  previous: Entity;
  next: EntityDbUpdate;
  actor: EntityMutationActor;
  auditMetadata?: Record<string, unknown>;
  versionKind?: EntityVersionKind;
  appliedCaseRevisionId?: string | null;
};

type ConditionalUpdateEntityWithAuditParams = UpdateEntityWithAuditParams & {
  expectedVersion: number;
};

export const createEntityWithAudit = async (
  db: DatabaseAdapter,
  params: CreateEntityWithAuditParams
) => {
  const row = await db.catalog.createEntity(params.entity);

  await logAudit(db, {
    workspace: params.workspace,
    userId: params.actor.id,
    userDisplayName: params.actor.displayName,
    operation: 'create',
    entityType: 'entity',
    entityId: row.id,
    entityName: row.name,
    entitySlug: row.slug,
    schemaId: row.schema_id,
    changes: {
      new: flattenEntityAuditFields(row)
    }
  });

  await db.catalog.createEntityVersion({
    id: crypto.randomUUID(),
    workspace: params.workspace,
    entity_id: row.id,
    version_number: row.version ?? 1,
    kind: 'autosave',
    commit_message: null,
    created_at: new Date(),
    created_by: params.actor.id,
    state: entityToBaseState(row),
    applied_case_revision_id: null
  });
  await db.catalog.pruneAutosaveVersions(params.workspace, row.id, AUTOSAVE_KEEP_COUNT);

  return row;
};

// A genuine user edit to any entity field marks all of that entity's external-field metadata
// `outdated` — unless the caller already set `generated_metadata` explicitly (an external update
// applying its own result, which must not outdate itself).
const withOutdatedMetadataIfChanged = (previous: Entity, next: EntityDbUpdate): EntityDbUpdate => {
  if (next.generated_metadata !== undefined) return next;
  const currentMetadata = previous.generated_metadata ?? {};
  if (Object.keys(currentMetadata).length === 0) return next;
  const dataKeys = new Set([...Object.keys(previous.data), ...Object.keys(next.data)]);
  const dataChanged = [...dataKeys].some(
    key => !valueEquals(previous.data[key] ?? null, next.data[key] ?? null)
  );
  return dataChanged
    ? { ...next, generated_metadata: outdateExternalMetadata(currentMetadata) }
    : next;
};

export const updateEntityWithAudit = async (
  db: DatabaseAdapter,
  params: UpdateEntityWithAuditParams
) => {
  const next = withOutdatedMetadataIfChanged(params.previous, params.next);
  const row = await db.catalog.updateEntity(params.workspace, params.entityId, next);

  if (row == null) return null;

  await logAudit(db, {
    workspace: params.workspace,
    userId: params.actor.id,
    userDisplayName: params.actor.displayName,
    operation: 'update',
    entityType: 'entity',
    entityId: params.entityId,
    entityName: row.name,
    entitySlug: row.slug,
    schemaId: row.schema_id,
    changes: computeChanges(
      flattenEntityAuditFields(params.previous),
      flattenEntityAuditFields(row)
    ),
    metadata: params.auditMetadata
  });

  await db.catalog.createEntityVersion({
    id: crypto.randomUUID(),
    workspace: params.workspace,
    entity_id: params.entityId,
    version_number: row.version ?? 1,
    kind: params.versionKind ?? 'autosave',
    commit_message: null,
    created_at: new Date(),
    created_by: params.actor.id,
    state: entityToBaseState(row),
    applied_case_revision_id: params.appliedCaseRevisionId ?? null
  });
  await db.catalog.pruneAutosaveVersions(params.workspace, params.entityId, AUTOSAVE_KEEP_COUNT);

  return row;
};

export const updateEntityWithAuditIfVersion = async (
  db: DatabaseAdapter,
  params: ConditionalUpdateEntityWithAuditParams
) => {
  const next = withOutdatedMetadataIfChanged(params.previous, params.next);
  const row = await db.catalog.updateEntityIfVersion(
    params.workspace,
    params.entityId,
    next,
    params.expectedVersion
  );

  if (row == null) return null;

  await logAudit(db, {
    workspace: params.workspace,
    userId: params.actor.id,
    userDisplayName: params.actor.displayName,
    operation: 'update',
    entityType: 'entity',
    entityId: params.entityId,
    entityName: row.name,
    entitySlug: row.slug,
    schemaId: row.schema_id,
    changes: computeChanges(
      flattenEntityAuditFields(params.previous),
      flattenEntityAuditFields(row)
    ),
    metadata: params.auditMetadata
  });

  await db.catalog.createEntityVersion({
    id: crypto.randomUUID(),
    workspace: params.workspace,
    entity_id: params.entityId,
    version_number: row.version ?? 1,
    kind: params.versionKind ?? 'autosave',
    commit_message: null,
    created_at: new Date(),
    created_by: params.actor.id,
    state: entityToBaseState(row),
    applied_case_revision_id: params.appliedCaseRevisionId ?? null
  });
  await db.catalog.pruneAutosaveVersions(params.workspace, params.entityId, AUTOSAVE_KEEP_COUNT);

  return row;
};
