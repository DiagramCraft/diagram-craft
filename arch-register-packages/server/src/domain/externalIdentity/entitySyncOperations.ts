import { randomUUID } from 'node:crypto';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthorizationContext } from '@arch-register/permissions';
import { httpAssert } from '../../utils/httpAssert';
import {
  requireEntityAction,
  requireCanCreateTopLevelEntity,
  requireWorkspaceCapability
} from '../auth/authorization';
import type { EntityMutationActor } from '../catalog/entityMutations';
import { createEntityWithAudit, updateEntityWithAudit } from '../catalog/entityMutations';
import { toApiEntity } from '../catalog/entityHelpers';
import {
  handleError,
  parseEntityMutationPayload,
  resolveCreateOwner,
  getEntityParentsFromPayload,
  getLifecycleValues,
  getTeamIds,
  normalizeEntityRelationFields
} from '../catalog/dataHelpers';
import { allocateEntityPublicId } from '../catalog/entityMutationOperations';
import { entityRequiresApproval } from '../catalog/entityChangeOperations';
import { assertNoExternalEntityFieldWrites } from '../catalog/entityValidation';
import { computeEntityCompleteness } from '../../utils/completeness';
import { listAllCatalogEntities } from '../catalog/entityLoader';
import { valueEquals } from '../externalMetadata/externalMetadataHelpers';
import {
  filterRestrictedFieldGroups,
  requireNoRestrictedFieldWrites
} from '../auth/fieldGroupAccessControl';
import type { EntityDbResult, SchemaDbResult } from '../catalog/db/catalogDatabase';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import {
  runExternalIdentitySyncInTransaction,
  validateExternalIdentity,
  valuesUnchanged,
  type ExternalIdentitySyncStatus
} from './externalIdentitySync';

export type EntitySyncStatus = ExternalIdentitySyncStatus;

export type EntitySyncResult = {
  status: EntitySyncStatus;
  entity: EntityRecord;
};

const assertKnownFieldIds = (schema: SchemaDbResult, fields: Record<string, unknown>) => {
  const knownFieldIds = new Set(schema.fields.map(field => field.id));
  const unknown = Object.keys(fields).filter(key => !knownFieldIds.has(key));
  httpAssert.true(unknown.length === 0, {
    status: 400,
    message: `Unknown field id(s) for schema '${schema.name}': ${unknown.join(', ')}`
  });
};

const entityUnchanged = (
  oldRow: EntityDbResult,
  next: {
    name: string;
    slug: string;
    namespace: string;
    description: string;
    owner: string | null;
    lifecycle: string | null;
    target_lifecycle: string | null;
    target_lifecycle_date: string | null;
    tags: string[];
    links: unknown[];
    project_id: string | null;
    data: Record<string, unknown>;
  },
  authCtx: AuthorizationContext | null,
  schema: SchemaDbResult
) =>
  oldRow.name === next.name &&
  oldRow.slug === next.slug &&
  oldRow.namespace === next.namespace &&
  oldRow.description === next.description &&
  oldRow.owner === next.owner &&
  oldRow.lifecycle === next.lifecycle &&
  oldRow.target_lifecycle === next.target_lifecycle &&
  oldRow.target_lifecycle_date === next.target_lifecycle_date &&
  oldRow.project_id === next.project_id &&
  JSON.stringify(oldRow.tags) === JSON.stringify(next.tags) &&
  JSON.stringify(oldRow.links) === JSON.stringify(next.links) &&
  valuesUnchanged(
    filterRestrictedFieldGroups(authCtx, schema, oldRow.data),
    filterRestrictedFieldGroups(authCtx, schema, next.data)
  );

const resolveEntityLifecycles = async (
  db: DatabaseAdapter,
  workspace: string,
  payload: ReturnType<typeof parseEntityMutationPayload>
) => {
  const lifecycleValues = await getLifecycleValues(db, workspace);
  return {
    lifecycle:
      payload.requestedLifecycle && lifecycleValues.has(payload.requestedLifecycle)
        ? payload.requestedLifecycle
        : null,
    target_lifecycle:
      payload.requestedTargetLifecycle && lifecycleValues.has(payload.requestedTargetLifecycle)
        ? payload.requestedTargetLifecycle
        : null,
    target_lifecycle_date: payload.requestedTargetLifecycleDate ?? null
  };
};

export const runEntitySyncInTransaction = async (
  db: DatabaseAdapter,
  workspace: string,
  source: string,
  externalKey: string,
  body: Record<string, unknown>,
  authCtx: AuthorizationContext | null,
  actor: EntityMutationActor,
  auditMetadata: Record<string, unknown> = {}
): Promise<EntitySyncResult> => {
  const result = await runExternalIdentitySyncInTransaction({
    db,
    workspace,
    source,
    externalKey,
    body,
    authCtx,
    actor,
    auditMetadata,
    handlers: {
      authorize: currentAuthCtx => {
        if (currentAuthCtx) {
          requireWorkspaceCapability(
            currentAuthCtx,
            'ent.external_update',
            'You do not have permission to sync entities from this integration source'
          );
        }
      },
      parse: parseEntityMutationPayload,
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
        const [oldRow, schema, entities] = await Promise.all([
          tx.catalog.getEntity(ws, recordId),
          tx.catalog.getSchema(ws, payload.schemaId),
          listAllCatalogEntities(tx, ws)
        ]);
        httpAssert.present(oldRow, {
          status: 404,
          message: `Entity for external identity '${syncSource}/${syncExternalKey}' no longer exists`
        });
        httpAssert.present(schema, {
          status: 404,
          message: `Schema '${payload.schemaId}' not found`
        });
        httpAssert.true(payload.schemaId === oldRow.schema_id, {
          status: 400,
          message: "Cannot change an entity's schema via sync"
        });
        httpAssert.true(!(await entityRequiresApproval(tx, ws, schema, oldRow)), {
          status: 409,
          statusText: 'Conflict',
          message: 'This entity requires an approved change proposal before it can be edited'
        });
        if (syncAuthCtx) {
          requireEntityAction(
            syncAuthCtx,
            oldRow,
            'view_entity',
            'You do not have permission to view this entity'
          );
        }

        assertKnownFieldIds(schema, payload.fields);
        const normalizedFields = normalizeEntityRelationFields({
          schema,
          fields: payload.fields,
          entities
        });
        assertNoExternalEntityFieldWrites(schema.fields, oldRow.data, normalizedFields);
        if (syncAuthCtx) {
          const changedFieldIds = Object.keys(normalizedFields).filter(
            fieldId => !valueEquals(oldRow.data[fieldId] ?? null, normalizedFields[fieldId] ?? null)
          );
          requireNoRestrictedFieldWrites(
            syncAuthCtx,
            schema,
            changedFieldIds,
            'You do not have permission to edit one or more restricted fields on this entity'
          );
        }

        const lifecycle = await resolveEntityLifecycles(tx, ws, payload);
        const teamIds = await getTeamIds(tx, ws);
        const ownerWasSubmitted = Object.hasOwn(syncBody, '_owner');
        const owner = !ownerWasSubmitted
          ? oldRow.owner
          : payload.requestedOwner && teamIds.has(payload.requestedOwner)
            ? payload.requestedOwner
            : null;
        const next = {
          name: payload.name,
          slug: payload.slug,
          namespace: payload.namespace,
          description: payload.description,
          owner,
          ...lifecycle,
          tags: payload.tags,
          links: payload.links,
          project_id: payload.projectId,
          data: normalizedFields
        };

        return { record: oldRow, next, state: { schema } };
      },
      isUnchanged: ({ record, next, authCtx: syncAuthCtx, state }) =>
        entityUnchanged(record, next, syncAuthCtx, state.schema),
      update: async ({ sync, record, next, state }) => {
        const timestamp = new Date();
        const row = await updateEntityWithAudit(sync.db, {
          workspace: sync.workspace,
          entityId: record.id,
          previous: record,
          actor: sync.actor,
          auditMetadata: sync.auditMetadata,
          next: {
            ...next,
            schema_id: sync.payload.schemaId,
            updated_at: timestamp,
            completeness: computeEntityCompleteness(
              {
                description: next.description,
                owner: next.owner,
                lifecycle: next.lifecycle,
                data: next.data
              },
              state.schema
            )
          }
        });
        httpAssert.present(row, {
          status: 404,
          message: `Entity for external identity '${sync.source}/${sync.externalKey}' no longer exists`
        });
        return row;
      },
      prepareCreate: async ({ db: tx, workspace: ws, authCtx: syncAuthCtx, payload }) => {
        // No existing identity — creating a new entity requires the same ownership/parent-tier
        // permissions as a regular entity creation, in addition to the integration capability.
        const [schema, entities] = await Promise.all([
          tx.catalog.getSchema(ws, payload.schemaId),
          listAllCatalogEntities(tx, ws)
        ]);
        httpAssert.present(schema, {
          status: 404,
          message: `Schema '${payload.schemaId}' not found`
        });

        assertKnownFieldIds(schema, payload.fields);
        const normalizedFields = normalizeEntityRelationFields({
          schema,
          fields: payload.fields,
          entities
        });
        assertNoExternalEntityFieldWrites(schema.fields, {}, normalizedFields);
        if (syncAuthCtx) {
          requireNoRestrictedFieldWrites(
            syncAuthCtx,
            schema,
            Object.keys(normalizedFields),
            'You do not have permission to set one or more restricted fields on this entity'
          );
        }

        const entityLookup = new Map(entities.map(entity => [entity.id, entity]));
        const parents = getEntityParentsFromPayload(schema, normalizedFields, entityLookup);
        const teamIds = await getTeamIds(tx, ws);
        const fallbackOwner = (await tx.workspace.listTeams(ws))[0]?.id ?? null;
        const owner = resolveCreateOwner(
          payload.requestedOwner,
          parents,
          schema,
          teamIds,
          fallbackOwner
        );

        if (syncAuthCtx) {
          if (parents.length > 0) {
            parents.forEach(parent =>
              requireEntityAction(
                syncAuthCtx,
                parent,
                'create_child',
                'You do not have permission to add children under one or more parent entities'
              )
            );
          } else {
            requireCanCreateTopLevelEntity(
              syncAuthCtx,
              owner,
              'Top-level entity creation requires membership in the resolved owner team or a platform admin role'
            );
          }
        }

        return {
          schema,
          normalizedFields,
          owner,
          lifecycle: await resolveEntityLifecycles(tx, ws, payload)
        };
      },
      create: async ({ sync, state }) => {
        const timestamp = new Date();
        const publicId = await allocateEntityPublicId(
          sync.db,
          sync.workspace,
          sync.payload.schemaId,
          timestamp
        );
        return createEntityWithAudit(sync.db, {
          workspace: sync.workspace,
          actor: sync.actor,
          entity: {
            id: randomUUID(),
            workspace: sync.workspace,
            public_id: publicId,
            slug: sync.payload.slug,
            namespace: sync.payload.namespace,
            name: sync.payload.name,
            description: sync.payload.description,
            owner: state.owner,
            lifecycle: state.lifecycle.lifecycle,
            target_lifecycle: state.lifecycle.target_lifecycle,
            target_lifecycle_date: state.lifecycle.target_lifecycle_date,
            tags: sync.payload.tags,
            links: sync.payload.links,
            schema_id: sync.payload.schemaId,
            data: state.normalizedFields,
            project_id: sync.payload.projectId,
            created_at: timestamp,
            updated_at: timestamp,
            completeness: computeEntityCompleteness(
              {
                description: sync.payload.description,
                owner: state.owner,
                lifecycle: state.lifecycle.lifecycle,
                data: state.normalizedFields
              },
              state.schema
            )
          },
          auditMetadata: sync.auditMetadata
        });
      },
      recordId: record => record.id,
      toResult: (record, syncAuthCtx, state) => toApiEntity(record, syncAuthCtx, state.schema)
    }
  });

  return { status: result.status, entity: result.result };
};

export const getEntityByExternalKey = async (
  db: DatabaseAdapter,
  workspace: string,
  source: string,
  externalKey: string,
  authCtx: AuthorizationContext | null
): Promise<EntityRecord> => {
  validateExternalIdentity(source, externalKey);

  try {
    if (authCtx) {
      requireWorkspaceCapability(
        authCtx,
        'ent.external_update',
        'You do not have permission to access entities from this integration source'
      );
    }

    const existingIdentity = await db.externalIdentity.find(workspace, source, externalKey);
    httpAssert.present(existingIdentity, {
      status: 404,
      message: `Entity with external identity '${source}/${externalKey}' not found`
    });

    const entity = await db.catalog.getEntity(workspace, existingIdentity.record_id);
    httpAssert.present(entity, {
      status: 404,
      message: `Entity for external identity '${source}/${externalKey}' no longer exists`
    });

    if (authCtx) {
      requireEntityAction(
        authCtx,
        entity,
        'view_entity',
        'You do not have permission to view this entity'
      );
    }

    const schema = await db.catalog.getSchema(workspace, entity.schema_id);
    return toApiEntity(entity, authCtx, schema);
  } catch (error) {
    return handleError(error, 'Failed to get entity by external key');
  }
};

export const syncEntityByExternalKey = async (
  db: DatabaseAdapter,
  workspace: string,
  source: string,
  externalKey: string,
  body: Record<string, unknown>,
  authCtx: AuthorizationContext | null,
  actor: EntityMutationActor
): Promise<EntitySyncResult> => {
  validateExternalIdentity(source, externalKey);

  try {
    return await db.core.transaction(tx =>
      runEntitySyncInTransaction(tx, workspace, source, externalKey, body, authCtx, actor)
    );
  } catch (error) {
    return handleError(error, 'Failed to sync entity');
  }
};
