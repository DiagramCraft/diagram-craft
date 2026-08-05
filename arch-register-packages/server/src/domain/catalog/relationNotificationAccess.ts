import type { WorkspaceAuthorizationContext } from '@arch-register/permissions';
import type { DatabaseAdapter } from '../../db/database';
import { getEntitySchemaAt, getRelationSchemaAt } from './schemaHistory';
import { canViewTypedRelation } from './relationAccessControl';

export type RelationNotificationVisibilityInput = {
  relationSchemaId: string;
  inEntityId: string;
  outEntityId: string;
  at: Date;
  owner?: string | null;
};

/**
 * Checks whether a notification recipient could have seen a relation edge at the time the
 * event occurred. Relation notifications are asynchronous and may outlive both schema ACL
 * changes and the relation row itself, so owner-field checks must use the historical schemas
 * applicable to the audit/event timestamp and fail closed when that history is unavailable.
 */
export const canViewRelationNotification = async (
  db: DatabaseAdapter,
  workspace: string,
  authCtx: WorkspaceAuthorizationContext,
  input: RelationNotificationVisibilityInput
): Promise<boolean> => {
  if (
    !input.relationSchemaId ||
    !input.inEntityId ||
    !input.outEntityId ||
    Number.isNaN(input.at.getTime())
  ) {
    return false;
  }

  const [relationSchema, inEntity, outEntity] = await Promise.all([
    getRelationSchemaAt(db, workspace, input.relationSchemaId, input.at),
    db.catalog.getEntity(workspace, input.inEntityId),
    db.catalog.getEntity(workspace, input.outEntityId)
  ]);
  if (!relationSchema || !inEntity || !outEntity) return false;

  const [inSchema, outSchema] = await Promise.all([
    getEntitySchemaAt(db, workspace, inEntity.schema_id, input.at),
    getEntitySchemaAt(db, workspace, outEntity.schema_id, input.at)
  ]);
  if (!inSchema || !outSchema) return false;

  return canViewTypedRelation(
    authCtx,
    [
      { schema: inSchema, direction: 'in' },
      { schema: outSchema, direction: 'out' }
    ],
    input.relationSchemaId,
    input.owner ?? null
  );
};
