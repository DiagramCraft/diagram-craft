import type { AuthorizationContext } from '@arch-register/permissions';
import type { DatabaseAdapter } from '../../db/database';
import { httpAssert } from '../../utils/httpAssert';
import { requireNoRestrictedFieldWrites } from '../auth/fieldGroupAccessControl';
import { equalEntityValue } from './entityDiff';
import type { Entity } from './db/catalogDatabase';
import type { RelationDbResult } from './db/relationDatabase';
import { asRecord } from './changeCaseContext';

export const requireNoRestrictedCaseMemberWrites = async (
  db: DatabaseAdapter,
  workspace: string,
  authCtx: AuthorizationContext,
  entity: Entity,
  proposedState: Record<string, unknown>
) => {
  const schemaId = String(proposedState['schema_id'] ?? entity.schema_id);
  const schema = await db.catalog.getSchema(workspace, schemaId);
  httpAssert.present(schema, { status: 400, message: `Schema '${schemaId}' not found` });

  const proposedData = asRecord(proposedState['data']);
  const changedFieldIds = Object.keys(proposedData).filter(
    fieldId => !equalEntityValue(entity.data[fieldId], proposedData[fieldId])
  );
  requireNoRestrictedFieldWrites(
    authCtx,
    schema,
    changedFieldIds,
    'You do not have permission to edit one or more restricted fields on this entity'
  );
};

export const requireNoRestrictedRelationCaseMemberWrites = async (
  db: DatabaseAdapter,
  workspace: string,
  authCtx: AuthorizationContext,
  relation: RelationDbResult,
  proposedState: Record<string, unknown>
) => {
  const schemaId = String(proposedState['schema_id'] ?? relation.schema_id);
  const schema = await db.relation.getRelationSchema(workspace, schemaId);
  httpAssert.present(schema, { status: 400, message: `Relation schema '${schemaId}' not found` });

  const proposedData = asRecord(proposedState['data']);
  const changedFieldIds = Object.keys(proposedData).filter(
    fieldId => !equalEntityValue(relation.data[fieldId], proposedData[fieldId])
  );
  requireNoRestrictedFieldWrites(
    authCtx,
    schema,
    changedFieldIds,
    'You do not have permission to edit one or more restricted fields on this relation'
  );
};
