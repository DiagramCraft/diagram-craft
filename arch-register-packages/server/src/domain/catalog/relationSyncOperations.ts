import { randomUUID } from 'node:crypto';
import type { DatabaseAdapter } from '../../db/database';
import type { WorkspaceAuthorizationContext } from '@arch-register/permissions';
import { httpAssert } from '../../utils/httpAssert';
import { requireWorkspaceCapability } from '../auth/authorization';
import { requireTypedRelationEdit, canViewTypedRelation } from './relationAccessControl';
import {
  filterRestrictedFieldGroups,
  requireNoRestrictedFieldWrites
} from '../auth/fieldGroupAccessControl';
import { valueEquals } from '../externalMetadata/externalMetadataHelpers';
import { assertNoExternalRelationFieldWrites } from './relationValidation';
import { getOwnerSchemas } from './relationOperations';
import {
  extractRelationFieldData,
  extractRelationOwnerOrLifecycleId,
  assertRelationMutationsSupported,
  validateRelationEndpoints,
  toRedactedApiRelation
} from './relationHelpers';
import { createRelationWithAudit, updateRelationWithAudit } from './relationMutations';
import type { RelationMutationActor } from './relationMutations';
import type { RelationDbResult, RelationSchemaDbResult } from './db/relationDatabase';
import type { RelationRecord } from '@arch-register/api-types/relationContract';
import {
  runExternalIdentitySyncInTransaction,
  validateExternalIdentity,
  valuesUnchanged,
  type ExternalIdentitySyncStatus
} from '../externalIdentity/externalIdentitySync';

export type RelationSyncStatus = ExternalIdentitySyncStatus;

export type RelationSyncResult = {
  status: RelationSyncStatus;
  relation: RelationRecord;
};

const assertKnownRelationFieldIds = (
  schema: RelationSchemaDbResult,
  fields: Record<string, unknown>
) => {
  const knownFieldIds = new Set(schema.fields.map(field => field.id));
  const unknown = Object.keys(fields).filter(key => !knownFieldIds.has(key));
  httpAssert.true(unknown.length === 0, {
    status: 400,
    message: `Unknown field id(s) for relation schema '${schema.name}': ${unknown.join(', ')}`
  });
};

const relationUnchanged = (
  oldRow: RelationDbResult,
  next: { owner: string | null; lifecycle: string | null; data: Record<string, unknown> },
  authCtx: WorkspaceAuthorizationContext | null,
  schema: RelationSchemaDbResult
) =>
  oldRow.owner === next.owner &&
  oldRow.lifecycle === next.lifecycle &&
  valuesUnchanged(
    filterRestrictedFieldGroups(authCtx, schema, oldRow.data, 'relation'),
    filterRestrictedFieldGroups(authCtx, schema, next.data, 'relation')
  );

const parseRelationSyncPayload = (body: Record<string, unknown>) => {
  const schemaId = body['_schemaId'];
  const inEntityId = body['_inEntityId'];
  const outEntityId = body['_outEntityId'];
  httpAssert.string(schemaId, { message: '_schemaId is required and must be a string' });
  httpAssert.string(inEntityId, { message: '_inEntityId is required and must be a string' });
  httpAssert.string(outEntityId, { message: '_outEntityId is required and must be a string' });
  return {
    schemaId,
    inEntityId,
    outEntityId,
    fields: extractRelationFieldData(body)
  };
};

const runRelationSync = async (
  db: DatabaseAdapter,
  workspace: string,
  source: string,
  externalKey: string,
  body: Record<string, unknown>,
  authCtx: WorkspaceAuthorizationContext | null,
  actor: RelationMutationActor
): Promise<RelationSyncResult> => {
  const result = await runExternalIdentitySyncInTransaction({
    db,
    workspace,
    source,
    externalKey,
    body,
    authCtx,
    actor,
    handlers: {
      authorize: currentAuthCtx => {
        if (currentAuthCtx) {
          requireWorkspaceCapability(
            currentAuthCtx,
            'ent.external_update',
            'You do not have permission to sync relations from this integration source'
          );
        }
      },
      parse: parseRelationSyncPayload,
      prepareExisting: async ({
        db: tx,
        workspace: ws,
        source: syncSource,
        externalKey: syncExternalKey,
        body: syncBody,
        authCtx: syncAuthCtx,
        payload,
        recordId
      }) => {
        const [oldRow, schema] = await Promise.all([
          tx.relation.getRelation(ws, recordId),
          tx.relation.getRelationSchema(ws, payload.schemaId)
        ]);
        httpAssert.present(oldRow, {
          status: 404,
          message: `Relation for external identity '${syncSource}/${syncExternalKey}' no longer exists`
        });
        httpAssert.present(schema, {
          status: 404,
          message: `Relation schema '${payload.schemaId}' not found`
        });
        httpAssert.true(payload.schemaId === oldRow.schema_id, {
          status: 400,
          message: "Cannot change a relation's schema via sync"
        });
        httpAssert.true(
          payload.inEntityId === oldRow.in_entity_id &&
            payload.outEntityId === oldRow.out_entity_id,
          {
            status: 400,
            message:
              'A relation\'s "in"/"out" endpoints are immutable after creation; delete and recreate it instead'
          }
        );
        assertRelationMutationsSupported(schema, oldRow);

        const { inSchema, outSchema } = await getOwnerSchemas(tx, ws, oldRow);
        if (syncAuthCtx) {
          requireTypedRelationEdit(
            syncAuthCtx,
            [
              { schema: inSchema, direction: 'in' },
              { schema: outSchema, direction: 'out' }
            ],
            oldRow.schema_id,
            oldRow.owner
          );
        }

        assertKnownRelationFieldIds(schema, payload.fields);
        assertNoExternalRelationFieldWrites(schema.fields, oldRow.data, payload.fields);
        if (syncAuthCtx) {
          const changedFieldIds = Object.keys(payload.fields).filter(
            fieldId => !valueEquals(oldRow.data[fieldId] ?? null, payload.fields[fieldId] ?? null)
          );
          requireNoRestrictedFieldWrites(
            syncAuthCtx,
            schema,
            changedFieldIds,
            'You do not have permission to edit one or more restricted fields on this relation'
          );
        }

        const nextOwner =
          '_owner' in syncBody
            ? extractRelationOwnerOrLifecycleId(syncBody['_owner'])
            : oldRow.owner;
        const nextLifecycle =
          '_lifecycle' in syncBody
            ? extractRelationOwnerOrLifecycleId(syncBody['_lifecycle'])
            : oldRow.lifecycle;
        const nextData = { ...oldRow.data, ...payload.fields };

        return {
          record: oldRow,
          next: { owner: nextOwner, lifecycle: nextLifecycle, data: nextData },
          state: { schema }
        };
      },
      isUnchanged: ({ record, next, authCtx: syncAuthCtx, state }) =>
        relationUnchanged(record, next, syncAuthCtx, state.schema),
      update: async ({ sync, record, next }) => {
        const row = await updateRelationWithAudit(sync.db, {
          workspace: sync.workspace,
          relationId: record.id,
          previous: record,
          next: {
            data: next.data,
            owner: next.owner,
            lifecycle: next.lifecycle,
            version: record.version + 1,
            updated_at: new Date()
          },
          actor: sync.actor,
          auditMetadata: sync.auditMetadata
        });
        httpAssert.present(row, {
          status: 404,
          message: `Relation for external identity '${sync.source}/${sync.externalKey}' no longer exists`
        });
        return row;
      },
      prepareCreate: async ({
        db: tx,
        workspace: ws,
        authCtx: syncAuthCtx,
        body: syncBody,
        payload
      }) => {
        // No existing identity — creation keeps the regular typed-relation endpoint and field
        // permissions in addition to the integration capability.
        const schema = await tx.relation.getRelationSchema(ws, payload.schemaId);
        httpAssert.present(schema, {
          status: 404,
          message: `Relation schema '${payload.schemaId}' not found`
        });

        const [inEntity, outEntity] = await Promise.all([
          tx.catalog.getEntity(ws, payload.inEntityId),
          tx.catalog.getEntity(ws, payload.outEntityId)
        ]);
        validateRelationEndpoints(schema, inEntity, outEntity);

        assertKnownRelationFieldIds(schema, payload.fields);
        assertNoExternalRelationFieldWrites(schema.fields, {}, payload.fields);

        const { inSchema, outSchema } = await getOwnerSchemas(tx, ws, {
          in_entity_id: inEntity!.id,
          out_entity_id: outEntity!.id
        });
        if (syncAuthCtx) {
          requireTypedRelationEdit(
            syncAuthCtx,
            [
              { schema: inSchema, direction: 'in' },
              { schema: outSchema, direction: 'out' }
            ],
            schema.id
          );
          requireNoRestrictedFieldWrites(
            syncAuthCtx,
            schema,
            Object.keys(payload.fields),
            'You do not have permission to set one or more restricted fields on this relation'
          );
        }

        const owner =
          '_owner' in syncBody
            ? extractRelationOwnerOrLifecycleId(syncBody['_owner'])
            : inEntity!.owner;
        const lifecycle =
          '_lifecycle' in syncBody
            ? extractRelationOwnerOrLifecycleId(syncBody['_lifecycle'])
            : inEntity!.lifecycle;

        return { schema, inEntity, outEntity, owner, lifecycle };
      },
      create: async ({ sync, state }) => {
        const timestamp = new Date();
        return createRelationWithAudit(sync.db, {
          workspace: sync.workspace,
          relation: {
            id: randomUUID(),
            workspace: sync.workspace,
            schema_id: sync.payload.schemaId,
            in_entity_id: state.inEntity!.id,
            out_entity_id: state.outEntity!.id,
            data: sync.payload.fields,
            owner: state.owner,
            lifecycle: state.lifecycle,
            created_at: timestamp,
            updated_at: timestamp
          },
          actor: sync.actor,
          auditMetadata: sync.auditMetadata
        });
      },
      recordId: record => record.id,
      toResult: (record, syncAuthCtx, state) =>
        toRedactedApiRelation(record, syncAuthCtx, state.schema)
    }
  });

  return { status: result.status, relation: result.result };
};

export const getRelationByExternalKey = async (
  db: DatabaseAdapter,
  workspace: string,
  source: string,
  externalKey: string,
  authCtx: WorkspaceAuthorizationContext | null
): Promise<RelationRecord> => {
  validateExternalIdentity(source, externalKey);

  if (authCtx) {
    requireWorkspaceCapability(
      authCtx,
      'ent.external_update',
      'You do not have permission to access relations from this integration source'
    );
  }

  const existingIdentity = await db.externalIdentity.find(workspace, source, externalKey);
  httpAssert.present(existingIdentity, {
    status: 404,
    message: `Relation with external identity '${source}/${externalKey}' not found`
  });

  const relation = await db.relation.getRelation(workspace, existingIdentity.record_id);
  httpAssert.present(relation, {
    status: 404,
    message: `Relation for external identity '${source}/${externalKey}' no longer exists`
  });

  const { inSchema, outSchema } = await getOwnerSchemas(db, workspace, relation);
  httpAssert.true(
    canViewTypedRelation(
      authCtx,
      [
        { schema: inSchema, direction: 'in' },
        { schema: outSchema, direction: 'out' }
      ],
      relation.schema_id,
      relation.owner
    ),
    { status: 404, message: `Relation with external identity '${source}/${externalKey}' not found` }
  );

  const schema = await db.relation.getRelationSchema(workspace, relation.schema_id);
  return toRedactedApiRelation(relation, authCtx, schema);
};

export const syncRelationByExternalKey = async (
  db: DatabaseAdapter,
  workspace: string,
  source: string,
  externalKey: string,
  body: Record<string, unknown>,
  authCtx: WorkspaceAuthorizationContext | null,
  actor: RelationMutationActor
): Promise<RelationSyncResult> => {
  validateExternalIdentity(source, externalKey);

  return db.core.transaction(tx =>
    runRelationSync(tx, workspace, source, externalKey, body, authCtx, actor)
  );
};
