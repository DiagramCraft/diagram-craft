import type { EntityDbCreate, DatabaseAdapter, EntityDbUpdate } from '../../db/database';
import { computeChanges, flattenEntityAuditFields, logAudit } from '../audit/db/auditLogging';
import { Entity } from './db/catalogDatabase';

const AUTOSAVE_KEEP_COUNT = 50;

const entityToBaseState = (row: Entity): Record<string, unknown> => ({
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
  visibility_mode: row.visibility_mode,
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

  await db.catalog.createSnapshot({
    id: crypto.randomUUID(),
    workspace: params.workspace,
    entity_id: row.id,
    status: 'autosave',
    project_id: null,
    target_date: null,
    commit_message: null,
    created_at: new Date(),
    created_by: params.actor.id,
    created_by_name: params.actor.displayName,
    base_state: entityToBaseState(row),
    proposed_state: null
  });
  await db.catalog.pruneAutosaveSnapshots(params.workspace, row.id, AUTOSAVE_KEEP_COUNT);

  return row;
};

export const updateEntityWithAudit = async (
  db: DatabaseAdapter,
  params: UpdateEntityWithAuditParams
) => {
  const row = await db.catalog.updateEntity(params.workspace, params.entityId, params.next);

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

  await db.catalog.createSnapshot({
    id: crypto.randomUUID(),
    workspace: params.workspace,
    entity_id: params.entityId,
    status: 'autosave',
    project_id: null,
    target_date: null,
    commit_message: null,
    created_at: new Date(),
    created_by: params.actor.id,
    created_by_name: params.actor.displayName,
    base_state: entityToBaseState(params.previous),
    proposed_state: entityToBaseState(row)
  });
  await db.catalog.pruneAutosaveSnapshots(params.workspace, params.entityId, AUTOSAVE_KEEP_COUNT);

  return row;
};
