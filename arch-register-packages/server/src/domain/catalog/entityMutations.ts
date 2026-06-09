import type { EntityDbCreate, DatabaseAdapter, EntityDbUpdate } from '../../db/database';
import { computeChanges, flattenEntityAuditFields, logAudit } from '../audit/db/auditLogging';
import { Entity } from './db/catalogDatabase';

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
    )
  });

  return row;
};
