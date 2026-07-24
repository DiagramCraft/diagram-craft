import { randomUUID } from 'node:crypto';
import type { DatabaseAdapter } from '../../db/database';
import { DatabaseError } from '../../db/database';
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
import type { EntityDbResult, SchemaDbResult } from '../catalog/db/catalogDatabase';
import type { EntityRecord } from '@arch-register/api-types/entityContract';

export type EntitySyncStatus = 'created' | 'updated' | 'unchanged';

export type EntitySyncResult = {
  status: EntitySyncStatus;
  entity: EntityRecord;
};

const MAX_SOURCE_LENGTH = 200;
const MAX_EXTERNAL_KEY_LENGTH = 500;

const assertKnownFieldIds = (schema: SchemaDbResult, fields: Record<string, unknown>) => {
  const knownFieldIds = new Set(schema.fields.map(field => field.id));
  const unknown = Object.keys(fields).filter(key => !knownFieldIds.has(key));
  httpAssert.true(unknown.length === 0, {
    status: 400,
    message: `Unknown field id(s) for schema '${schema.name}': ${unknown.join(', ')}`
  });
};

const dataUnchanged = (previous: Record<string, unknown>, next: Record<string, unknown>) => {
  const keys = new Set([...Object.keys(previous), ...Object.keys(next)]);
  return [...keys].every(key => valueEquals(previous[key] ?? null, next[key] ?? null));
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
  }
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
  dataUnchanged(oldRow.data, next.data);

const runSync = async (
  db: DatabaseAdapter,
  workspace: string,
  source: string,
  externalKey: string,
  body: Record<string, unknown>,
  authCtx: AuthorizationContext | null,
  actor: EntityMutationActor
): Promise<EntitySyncResult> => {
  // Capability check happens first, before any other DB reads, so a caller without integration
  // access can't use this endpoint to probe for entity/schema existence.
  if (authCtx) {
    requireWorkspaceCapability(
      authCtx,
      'ent.external_update',
      'You do not have permission to sync entities from this integration source'
    );
  }

  const payload = parseEntityMutationPayload(body);
  const lifecycleValues = await getLifecycleValues(db, workspace);
  const lifecycle =
    payload.requestedLifecycle && lifecycleValues.has(payload.requestedLifecycle)
      ? payload.requestedLifecycle
      : null;
  const target_lifecycle =
    payload.requestedTargetLifecycle && lifecycleValues.has(payload.requestedTargetLifecycle)
      ? payload.requestedTargetLifecycle
      : null;
  const target_lifecycle_date = payload.requestedTargetLifecycleDate ?? null;

  const existingIdentity = await db.externalIdentity.find(workspace, source, externalKey);

  if (existingIdentity) {
    const [oldRow, schema, entities] = await Promise.all([
      db.catalog.getEntity(workspace, existingIdentity.entity_id),
      db.catalog.getSchema(workspace, payload.schemaId),
      listAllCatalogEntities(db, workspace)
    ]);
    httpAssert.present(oldRow, {
      status: 404,
      message: `Entity for external identity '${source}/${externalKey}' no longer exists`
    });
    httpAssert.present(schema, { status: 404, message: `Schema '${payload.schemaId}' not found` });
    httpAssert.true(payload.schemaId === oldRow.schema_id, {
      status: 400,
      message: "Cannot change an entity's schema via sync"
    });
    httpAssert.true(!entityRequiresApproval(schema, oldRow), {
      status: 409,
      statusText: 'Conflict',
      message: 'This entity requires an approved change proposal before it can be edited'
    });
    if (authCtx) {
      requireEntityAction(
        authCtx,
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

    const teamIds = await getTeamIds(db, workspace);
    const owner =
      payload.requestedOwner && teamIds.has(payload.requestedOwner) ? payload.requestedOwner : null;

    const next = {
      name: payload.name,
      slug: payload.slug,
      namespace: payload.namespace,
      description: payload.description,
      owner,
      lifecycle,
      target_lifecycle,
      target_lifecycle_date,
      tags: payload.tags,
      links: payload.links,
      project_id: payload.projectId,
      data: normalizedFields
    };

    if (entityUnchanged(oldRow, next)) {
      return { status: 'unchanged', entity: toApiEntity(oldRow, authCtx) };
    }

    const timestamp = new Date();
    const row = await updateEntityWithAudit(db, {
      workspace,
      entityId: oldRow.id,
      previous: oldRow,
      actor,
      auditMetadata: { sync_source: source, sync_external_key: externalKey },
      next: {
        ...next,
        schema_id: payload.schemaId,
        updated_at: timestamp,
        completeness: computeEntityCompleteness(
          { description: next.description, owner, lifecycle, data: normalizedFields },
          schema
        )
      }
    });
    httpAssert.present(row, {
      status: 404,
      message: `Entity for external identity '${source}/${externalKey}' no longer exists`
    });

    return { status: 'updated', entity: toApiEntity(row, authCtx) };
  }

  // No existing identity — creating a new entity requires the same ownership/parent-tier
  // permissions as a regular entity creation, in addition to the integration capability already
  // checked above. Holding `ent.external_update` alone (designed for field-level updates on
  // entities that already exist) is not sufficient to create arbitrary top-level entities.
  const [schema, entities] = await Promise.all([
    db.catalog.getSchema(workspace, payload.schemaId),
    listAllCatalogEntities(db, workspace)
  ]);
  httpAssert.present(schema, { status: 404, message: `Schema '${payload.schemaId}' not found` });

  assertKnownFieldIds(schema, payload.fields);
  const normalizedFields = normalizeEntityRelationFields({
    schema,
    fields: payload.fields,
    entities
  });
  assertNoExternalEntityFieldWrites(schema.fields, {}, normalizedFields);

  const entityLookup = new Map(entities.map(entity => [entity.id, entity]));
  const parents = getEntityParentsFromPayload(schema, normalizedFields, entityLookup);
  const teamIds = await getTeamIds(db, workspace);
  const fallbackOwner = (await db.workspace.listTeams(workspace))[0]?.id ?? null;
  const owner = resolveCreateOwner(payload.requestedOwner, parents, schema, teamIds, fallbackOwner);

  if (authCtx) {
    if (parents.length > 0) {
      parents.forEach(parent =>
        requireEntityAction(
          authCtx,
          parent,
          'create_child',
          'You do not have permission to add children under one or more parent entities'
        )
      );
    } else {
      requireCanCreateTopLevelEntity(
        authCtx,
        owner,
        'Top-level entity creation requires membership in the resolved owner team or a platform admin role'
      );
    }
  }

  const timestamp = new Date();
  const publicId = await allocateEntityPublicId(db, workspace, payload.schemaId, timestamp);
  const row = await createEntityWithAudit(db, {
    workspace,
    actor,
    entity: {
      id: randomUUID(),
      workspace,
      public_id: publicId,
      slug: payload.slug,
      namespace: payload.namespace,
      name: payload.name,
      description: payload.description,
      owner,
      lifecycle,
      target_lifecycle,
      target_lifecycle_date,
      tags: payload.tags,
      links: payload.links,
      schema_id: payload.schemaId,
      data: normalizedFields,
      project_id: payload.projectId,
      created_at: timestamp,
      updated_at: timestamp,
      completeness: computeEntityCompleteness(
        { description: payload.description, owner, lifecycle, data: normalizedFields },
        schema
      )
    }
  });

  try {
    await db.externalIdentity.create({
      workspace,
      source,
      external_key: externalKey,
      entity_id: row.id
    });
  } catch (error) {
    if (error instanceof DatabaseError && error.code === 'unique') {
      // Lost a race against a concurrent first sync for the same key — the other request already
      // created the entity and recorded the identity, so converge onto it instead of surfacing an
      // error (and leave the entity we just created; it has no identity row pointing at it).
      return runSync(db, workspace, source, externalKey, body, authCtx, actor);
    }
    throw error;
  }

  return { status: 'created', entity: toApiEntity(row, authCtx) };
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

  try {
    return await db.core.transaction(tx =>
      runSync(tx, workspace, source, externalKey, body, authCtx, actor)
    );
  } catch (error) {
    return handleError(error, 'Failed to sync entity');
  }
};
