import { randomUUID } from 'node:crypto';
import type { DatabaseAdapter } from '../../db/database';
import { DatabaseError } from '../../db/database';
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

export type RelationSyncStatus = 'created' | 'updated' | 'unchanged';

export type RelationSyncResult = {
  status: RelationSyncStatus;
  relation: RelationRecord;
};

const MAX_SOURCE_LENGTH = 200;
const MAX_EXTERNAL_KEY_LENGTH = 500;

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

const dataUnchanged = (previous: Record<string, unknown>, next: Record<string, unknown>) => {
  const keys = new Set([...Object.keys(previous), ...Object.keys(next)]);
  return [...keys].every(key => valueEquals(previous[key] ?? null, next[key] ?? null));
};

const relationUnchanged = (
  oldRow: RelationDbResult,
  next: { owner: string | null; lifecycle: string | null; data: Record<string, unknown> },
  authCtx: WorkspaceAuthorizationContext | null,
  schema: RelationSchemaDbResult
) =>
  oldRow.owner === next.owner &&
  oldRow.lifecycle === next.lifecycle &&
  dataUnchanged(
    filterRestrictedFieldGroups(authCtx, schema, oldRow.data),
    filterRestrictedFieldGroups(authCtx, schema, next.data)
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
  // Capability check happens first, before any other DB reads, so a caller without integration
  // access can't use this endpoint to probe for relation/schema existence.
  if (authCtx) {
    requireWorkspaceCapability(
      authCtx,
      'ent.external_update',
      'You do not have permission to sync relations from this integration source'
    );
  }

  const payload = parseRelationSyncPayload(body);
  const existingIdentity = await db.externalIdentity.find(workspace, source, externalKey);

  if (existingIdentity) {
    const [oldRow, schema] = await Promise.all([
      db.relation.getRelation(workspace, existingIdentity.record_id),
      db.relation.getRelationSchema(workspace, payload.schemaId)
    ]);
    httpAssert.present(oldRow, {
      status: 404,
      message: `Relation for external identity '${source}/${externalKey}' no longer exists`
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
      payload.inEntityId === oldRow.in_entity_id && payload.outEntityId === oldRow.out_entity_id,
      {
        status: 400,
        message:
          'A relation\'s "in"/"out" endpoints are immutable after creation; delete and recreate it instead'
      }
    );
    assertRelationMutationsSupported(schema, oldRow);

    const { inSchema, outSchema } = await getOwnerSchemas(db, workspace, oldRow);
    if (authCtx) {
      requireTypedRelationEdit(
        authCtx,
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
    if (authCtx) {
      const changedFieldIds = Object.keys(payload.fields).filter(
        fieldId => !valueEquals(oldRow.data[fieldId] ?? null, payload.fields[fieldId] ?? null)
      );
      requireNoRestrictedFieldWrites(
        authCtx,
        schema,
        changedFieldIds,
        'You do not have permission to edit one or more restricted fields on this relation'
      );
    }

    const nextOwner =
      '_owner' in body ? extractRelationOwnerOrLifecycleId(body['_owner']) : oldRow.owner;
    const nextLifecycle =
      '_lifecycle' in body
        ? extractRelationOwnerOrLifecycleId(body['_lifecycle'])
        : oldRow.lifecycle;
    const nextData = { ...oldRow.data, ...payload.fields };

    if (
      relationUnchanged(
        oldRow,
        { owner: nextOwner, lifecycle: nextLifecycle, data: nextData },
        authCtx,
        schema
      )
    ) {
      return { status: 'unchanged', relation: toRedactedApiRelation(oldRow, authCtx, schema) };
    }

    const row = await updateRelationWithAudit(db, {
      workspace,
      relationId: oldRow.id,
      previous: oldRow,
      next: {
        data: nextData,
        owner: nextOwner,
        lifecycle: nextLifecycle,
        version: oldRow.version + 1,
        updated_at: new Date()
      },
      actor,
      auditMetadata: { sync_source: source, sync_external_key: externalKey }
    });
    httpAssert.present(row, {
      status: 404,
      message: `Relation for external identity '${source}/${externalKey}' no longer exists`
    });

    return { status: 'updated', relation: toRedactedApiRelation(row, authCtx, schema) };
  }

  // No existing identity — creating a new relation requires the same endpoint/ownership
  // permissions as a regular relation creation, in addition to the integration capability
  // already checked above. Holding `ent.external_update` alone (designed for field-level
  // updates on relations that already exist) is not sufficient to create arbitrary relations.
  const schema = await db.relation.getRelationSchema(workspace, payload.schemaId);
  httpAssert.present(schema, {
    status: 404,
    message: `Relation schema '${payload.schemaId}' not found`
  });

  const [inEntity, outEntity] = await Promise.all([
    db.catalog.getEntity(workspace, payload.inEntityId),
    db.catalog.getEntity(workspace, payload.outEntityId)
  ]);
  validateRelationEndpoints(schema, inEntity, outEntity);

  assertKnownRelationFieldIds(schema, payload.fields);
  assertNoExternalRelationFieldWrites(schema.fields, {}, payload.fields);

  const { inSchema, outSchema } = await getOwnerSchemas(db, workspace, {
    in_entity_id: inEntity!.id,
    out_entity_id: outEntity!.id
  });
  if (authCtx) {
    requireTypedRelationEdit(
      authCtx,
      [
        { schema: inSchema, direction: 'in' },
        { schema: outSchema, direction: 'out' }
      ],
      schema.id
    );
    requireNoRestrictedFieldWrites(
      authCtx,
      schema,
      Object.keys(payload.fields),
      'You do not have permission to set one or more restricted fields on this relation'
    );
  }

  const owner =
    '_owner' in body ? extractRelationOwnerOrLifecycleId(body['_owner']) : inEntity!.owner;
  const lifecycle =
    '_lifecycle' in body
      ? extractRelationOwnerOrLifecycleId(body['_lifecycle'])
      : inEntity!.lifecycle;

  const timestamp = new Date();
  const row = await createRelationWithAudit(db, {
    workspace,
    relation: {
      id: randomUUID(),
      workspace,
      schema_id: payload.schemaId,
      in_entity_id: inEntity!.id,
      out_entity_id: outEntity!.id,
      data: payload.fields,
      owner,
      lifecycle,
      created_at: timestamp,
      updated_at: timestamp
    },
    actor,
    auditMetadata: { sync_source: source, sync_external_key: externalKey }
  });

  try {
    await db.externalIdentity.create({
      workspace,
      source,
      external_key: externalKey,
      record_id: row.id
    });
  } catch (error) {
    if (error instanceof DatabaseError && error.code === 'unique') {
      // Lost a race against a concurrent first sync for the same key — the other request already
      // created the relation and recorded the identity, so converge onto it instead of surfacing
      // an error (and leave the relation we just created; it has no identity row pointing at it).
      return runRelationSync(db, workspace, source, externalKey, body, authCtx, actor);
    }
    throw error;
  }

  return { status: 'created', relation: toRedactedApiRelation(row, authCtx, schema) };
};

const validateSourceAndExternalKey = (source: unknown, externalKey: unknown) => {
  httpAssert.string(source, { status: 400, message: 'source is required' });
  httpAssert.true(source.length <= MAX_SOURCE_LENGTH, {
    status: 400,
    message: `source must be at most ${MAX_SOURCE_LENGTH} characters`
  });
  httpAssert.string(externalKey, { status: 400, message: 'externalKey is required' });
  httpAssert.true(externalKey.length <= MAX_EXTERNAL_KEY_LENGTH, {
    status: 400,
    message: `externalKey must be at most ${MAX_EXTERNAL_KEY_LENGTH} characters`
  });
};

export const getRelationByExternalKey = async (
  db: DatabaseAdapter,
  workspace: string,
  source: string,
  externalKey: string,
  authCtx: WorkspaceAuthorizationContext | null
): Promise<RelationRecord> => {
  validateSourceAndExternalKey(source, externalKey);

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
  validateSourceAndExternalKey(source, externalKey);

  return db.core.transaction(tx =>
    runRelationSync(tx, workspace, source, externalKey, body, authCtx, actor)
  );
};
