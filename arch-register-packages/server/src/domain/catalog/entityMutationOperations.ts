import { randomUUID } from 'node:crypto';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthorizationContext } from '@arch-register/permissions';
import { slugify } from '../../utils/http';
import { httpAssert } from '../../utils/httpAssert';

import {
  requireEntityAction,
  requireCanCreateTopLevelEntity,
  requireWorkspaceCapability
} from '../auth/authorization';

import type { EntityMutationActor } from './entityMutations';
import { createEntityWithAudit, updateEntityWithAudit, entityToBaseState } from './entityMutations';
import { logAudit, flattenEntityAuditFields } from '../audit/db/auditLogging';
import { toApiEntity } from './entityHelpers';

import {
  handleError,
  parseEntityMutationPayload,
  resolveCreateOwner,
  getEntityParentsFromPayload,
  getLifecycleValues,
  getTeamIds,
  normalizeEntityRelationFields,
  relationFields
} from './dataHelpers';
import { formatPublicId } from '../../utils/publicIds';

import { EntityRecord } from '@arch-register/api-types/entityContract';

import { listAllCatalogEntities } from './entityLoader';

import type { Entity, EntityDbCreate, EntityDbResult, SchemaDbResult } from './db/catalogDatabase';
import { entityRequiresApproval } from './entityChangeOperations';
import { assertNoExternalEntityFieldWrites } from './entityValidation';
import type { ExternalMetadata } from '@arch-register/api-types/common';
import {
  applyExternalFieldUpdate,
  assertExternalUpdateOnlyChangesTarget,
  assertValidExternalUpdateTarget
} from '../externalMetadata/externalMetadataHelpers';

const allocateEntityPublicId = async (
  db: DatabaseAdapter,
  workspace: string,
  schemaId: string,
  timestamp: Date
) => {
  const schema = await db.catalog.getSchema(workspace, schemaId);
  httpAssert.present(schema, { status: 404, message: `Schema '${schemaId}' not found` });
  httpAssert.present(schema.key_prefix, {
    status: 409,
    message: `Schema '${schemaId}' is missing a key prefix`
  });
  const sequenceNumber = await db.workspace.allocatePublicId(schema.key_prefix, timestamp);
  return formatPublicId(schema.key_prefix, sequenceNumber);
};
export const createEntity = async (
  db: DatabaseAdapter,
  workspace: string,
  body: Record<string, unknown>,
  authCtx: AuthorizationContext | null,
  actor: EntityMutationActor
): Promise<EntityRecord> => {
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
  const teamIds = await getTeamIds(db, workspace);

  try {
    const [schema, entities] = await Promise.all([
      db.catalog.getSchema(workspace, payload.schemaId),
      listAllCatalogEntities(db, workspace)
    ]);
    httpAssert.present(schema, {
      status: 404,
      message: `Schema '${payload.schemaId}' not found`
    });
    const normalizedFields = normalizeEntityRelationFields({
      schema,
      fields: payload.fields,
      entities
    });
    assertNoExternalEntityFieldWrites(schema.fields, {}, normalizedFields);
    const entityLookup = new Map(entities.map(entity => [entity.id, entity]));
    const parents = getEntityParentsFromPayload(schema, normalizedFields, entityLookup);
    const fallbackOwner = (await db.workspace.listTeams(workspace))[0]?.id ?? null;
    const owner = resolveCreateOwner(
      payload.requestedOwner,
      parents,
      schema,
      teamIds,
      fallbackOwner
    );

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
        updated_at: timestamp
      }
    });

    return toApiEntity(row, authCtx);
  } catch (error) {
    return handleError(error, 'Failed to create data record');
  }
};

type BulkEntityDraft = {
  payload: ReturnType<typeof parseEntityMutationPayload>;
  schema: SchemaDbResult;
  entity: EntityDbCreate;
};

const canonicalizeBulkRelationFields = (
  fields: Record<string, unknown>,
  schema: SchemaDbResult,
  nameToId: Map<string, string>
) => {
  const normalized = { ...fields };
  for (const field of relationFields(schema.fields)) {
    let value = normalized[field.id];
    if (value == null && normalized[field.name] != null) {
      value = normalized[field.name];
      delete normalized[field.name];
    }

    if (typeof value !== 'string') continue;
    const names = value
      .split(',')
      .map(name => name.trim())
      .filter(Boolean);
    normalized[field.id] = names.map(name => {
      const id = nameToId.get(name.toLowerCase());
      httpAssert.present(id, {
        status: 400,
        message: `${field.name} references unknown batch entity '${name}'`
      });
      return id;
    });
  }
  return normalized;
};

const resolveBulkOwners = (
  drafts: BulkEntityDraft[],
  existingEntities: EntityDbResult[],
  teamIds: Set<string>,
  fallbackOwner: string | null
) => {
  const existingById = new Map(existingEntities.map(entity => [entity.id, entity]));
  const draftById = new Map(drafts.map(draft => [draft.entity.id, draft]));
  const resolving = new Set<string>();

  const resolveOwner = (draft: BulkEntityDraft): string | null => {
    const explicit = draft.payload.requestedOwner;
    if (explicit && teamIds.has(explicit)) return explicit;
    if (draft.entity.owner) return draft.entity.owner;
    if (resolving.has(draft.entity.id)) {
      return draft.schema.default_owner && teamIds.has(draft.schema.default_owner)
        ? draft.schema.default_owner
        : fallbackOwner;
    }

    resolving.add(draft.entity.id);
    const parentIds = relationFields(draft.schema.fields)
      .filter(field => field.type === 'containment')
      .flatMap(field => {
        const value = draft.entity.data[field.id];
        return Array.isArray(value)
          ? value.filter((id): id is string => typeof id === 'string')
          : [];
      });
    for (const parentId of parentIds) {
      const parent = existingById.get(parentId);
      const owner =
        parent?.owner ?? (draftById.get(parentId) ? resolveOwner(draftById.get(parentId)!) : null);
      if (owner && teamIds.has(owner)) {
        draft.entity.owner = owner;
        resolving.delete(draft.entity.id);
        return owner;
      }
    }
    resolving.delete(draft.entity.id);
    const owner =
      draft.schema.default_owner && teamIds.has(draft.schema.default_owner)
        ? draft.schema.default_owner
        : fallbackOwner && teamIds.has(fallbackOwner)
          ? fallbackOwner
          : null;
    draft.entity.owner = owner;
    return owner;
  };

  drafts.forEach(resolveOwner);
};

export const bulkCreateEntities = async (
  db: DatabaseAdapter,
  workspace: string,
  bodies: Record<string, unknown>[],
  authCtx: AuthorizationContext | null,
  actor: EntityMutationActor
): Promise<EntityRecord[]> => {
  try {
    return await db.core.transaction(async tx => {
      const payloads = bodies.map(parseEntityMutationPayload);
      const nameToId = new Map<string, string>();
      for (const payload of payloads) {
        const key = payload.name.trim().toLowerCase();
        httpAssert.string(key, { message: '_name is required' });
        httpAssert.true(!nameToId.has(key), {
          status: 400,
          message: `Duplicate batch entity name '${payload.name}'`
        });
        nameToId.set(key, randomUUID());
      }

      const [schemas, existingEntities, lifecycleValues, teamRows] = await Promise.all([
        tx.catalog.listSchemas(workspace),
        listAllCatalogEntities(tx, workspace),
        getLifecycleValues(tx, workspace),
        tx.workspace.listTeams(workspace)
      ]);
      const schemaById = new Map(schemas.map(schema => [schema.id, schema]));
      const teamIds = new Set(teamRows.map(team => team.id));
      const fallbackOwner = teamRows[0]?.id ?? null;
      const timestamp = new Date();

      const drafts: BulkEntityDraft[] = payloads.map(payload => {
        const schema = schemaById.get(payload.schemaId);
        httpAssert.present(schema, {
          status: 404,
          message: `Schema '${payload.schemaId}' not found`
        });
        const lifecycle =
          payload.requestedLifecycle && lifecycleValues.has(payload.requestedLifecycle)
            ? payload.requestedLifecycle
            : null;
        const targetLifecycle =
          payload.requestedTargetLifecycle && lifecycleValues.has(payload.requestedTargetLifecycle)
            ? payload.requestedTargetLifecycle
            : null;
        return {
          payload,
          schema,
          entity: {
            id: nameToId.get(payload.name.trim().toLowerCase())!,
            workspace,
            public_id: '',
            slug: payload.slug,
            namespace: payload.namespace,
            name: payload.name,
            description: payload.description,
            owner: null,
            lifecycle,
            target_lifecycle: targetLifecycle,
            target_lifecycle_date: payload.requestedTargetLifecycleDate,
            tags: payload.tags,
            links: payload.links,
            schema_id: payload.schemaId,
            data: canonicalizeBulkRelationFields(payload.fields, schema, nameToId),
            project_id: payload.projectId,
            created_at: timestamp,
            updated_at: timestamp
          }
        };
      });

      resolveBulkOwners(drafts, existingEntities, teamIds, fallbackOwner);
      const allEntities: Entity[] = [...existingEntities, ...drafts.map(draft => draft.entity)];
      const entityLookup = new Map(allEntities.map(entity => [entity.id, entity]));

      for (const draft of drafts) {
        draft.entity.data = normalizeEntityRelationFields({
          schema: draft.schema,
          fields: draft.entity.data,
          entities: allEntities
        });
        assertNoExternalEntityFieldWrites(draft.schema.fields, {}, draft.entity.data);
        const parents = getEntityParentsFromPayload(draft.schema, draft.entity.data, entityLookup);
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
              draft.entity.owner,
              'Top-level entity creation requires membership in the resolved owner team or a platform admin role'
            );
          }
        }
      }

      for (const draft of drafts) {
        draft.entity.public_id = await allocateEntityPublicId(
          tx,
          workspace,
          draft.entity.schema_id,
          timestamp
        );
      }

      const created: EntityRecord[] = [];
      for (const draft of drafts) {
        const row = await createEntityWithAudit(tx, {
          workspace,
          actor,
          entity: draft.entity
        });
        created.push(toApiEntity(row, authCtx));
      }
      return created;
    });
  } catch (error) {
    return handleError(error, 'Failed to create data records');
  }
};

export const updateEntity = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  body: Record<string, unknown>,
  authCtx: AuthorizationContext | null,
  actor: EntityMutationActor
): Promise<EntityRecord> => {
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
  const teamIds = await getTeamIds(db, workspace);
  const owner =
    payload.requestedOwner && teamIds.has(payload.requestedOwner) ? payload.requestedOwner : null;

  try {
    const [oldRow, schema, entities] = await Promise.all([
      db.catalog.getEntity(workspace, id),
      db.catalog.getSchema(workspace, payload.schemaId),
      listAllCatalogEntities(db, workspace)
    ]);
    httpAssert.present(oldRow, { status: 404, message: `Data record '${id}' not found` });
    httpAssert.present(schema, {
      status: 404,
      message: `Schema '${payload.schemaId}' not found`
    });
    httpAssert.true(!entityRequiresApproval(schema, oldRow), {
      status: 409,
      statusText: 'Conflict',
      message: 'This entity requires an approved change proposal before it can be edited'
    });
    if (authCtx) {
      if (payload.external) {
        requireEntityAction(
          authCtx,
          oldRow,
          'view_entity',
          'You do not have permission to view this entity'
        );
        requireWorkspaceCapability(
          authCtx,
          'ent.external_update',
          'You do not have permission to perform external updates on entities'
        );
      } else {
        requireEntityAction(
          authCtx,
          oldRow,
          'edit_entity',
          'You do not have permission to edit this entity'
        );
      }
    }
    if (authCtx && (owner !== oldRow.owner || payload.projectId !== oldRow.project_id)) {
      requireEntityAction(
        authCtx,
        oldRow,
        'admin_entity',
        'You do not have permission to change ownership or project assignment'
      );
    }

    const normalizedFields = normalizeEntityRelationFields({
      schema,
      fields: payload.fields,
      entities
    });

    const timestamp = new Date();
    let nextGeneratedMetadata: ExternalMetadata | undefined;
    let auditMetadata: Record<string, unknown> | undefined;
    if (payload.external) {
      assertValidExternalUpdateTarget(
        schema.fields,
        payload.external,
        oldRow.data,
        normalizedFields
      );
      assertExternalUpdateOnlyChangesTarget(
        payload.external.fieldId,
        oldRow.data,
        normalizedFields
      );
      httpAssert.true(payload.schemaId === oldRow.schema_id, {
        status: 400,
        message: 'An external update cannot change the entity schema'
      });
      httpAssert.true(payload.name === oldRow.name, {
        status: 400,
        message: 'An external update cannot change the entity name'
      });
      httpAssert.true(payload.slug === oldRow.slug, {
        status: 400,
        message: 'An external update cannot change the entity slug'
      });
      httpAssert.true(payload.namespace === oldRow.namespace, {
        status: 400,
        message: 'An external update cannot change the entity namespace'
      });
      httpAssert.true(payload.description === oldRow.description, {
        status: 400,
        message: 'An external update cannot change the entity description'
      });
      httpAssert.true(payload.requestedOwner === oldRow.owner, {
        status: 400,
        message: 'An external update cannot change the entity owner'
      });
      httpAssert.true(payload.requestedLifecycle === oldRow.lifecycle, {
        status: 400,
        message: 'An external update cannot change the entity lifecycle'
      });
      httpAssert.true(payload.requestedTargetLifecycle === oldRow.target_lifecycle, {
        status: 400,
        message: 'An external update cannot change the target lifecycle'
      });
      httpAssert.true(payload.requestedTargetLifecycleDate === oldRow.target_lifecycle_date, {
        status: 400,
        message: 'An external update cannot change the target lifecycle date'
      });
      httpAssert.true(JSON.stringify(payload.tags) === JSON.stringify(oldRow.tags), {
        status: 400,
        message: 'An external update cannot change entity tags'
      });
      httpAssert.true(JSON.stringify(payload.links) === JSON.stringify(oldRow.links), {
        status: 400,
        message: 'An external update cannot change entity links'
      });
      httpAssert.true(payload.projectId === oldRow.project_id, {
        status: 400,
        message: 'An external update cannot change entity project assignment'
      });
      nextGeneratedMetadata = {
        ...(oldRow.generated_metadata ?? {}),
        [payload.external.fieldId]: applyExternalFieldUpdate(
          payload.external.fieldId,
          payload.external,
          timestamp
        )
      };
      auditMetadata = {
        external_kind: payload.external.kind,
        external_field_id: payload.external.fieldId,
        source: payload.external.source,
        status: payload.external.status,
        requestId: payload.external.requestId ?? null,
        explanation: payload.external.explanation ?? null,
        failureNotice: payload.external.failureNotice ?? null
      };
    } else {
      assertNoExternalEntityFieldWrites(schema.fields, oldRow.data, normalizedFields);
    }

    const row = await updateEntityWithAudit(db, {
      workspace,
      entityId: oldRow.id,
      previous: oldRow,
      actor,
      auditMetadata,
      next: {
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
        updated_at: timestamp,
        ...(nextGeneratedMetadata !== undefined
          ? { generated_metadata: nextGeneratedMetadata }
          : {})
      }
    });

    httpAssert.present(row, { status: 404, message: `Data record '${id}' not found` });
    return toApiEntity(row, authCtx);
  } catch (error) {
    return handleError(error, 'Failed to update data record');
  }
};

export const cloneEntity = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  authCtx: AuthorizationContext | null,
  actor: EntityMutationActor
): Promise<EntityRecord> => {
  try {
    const source = await db.catalog.getEntity(workspace, id);
    httpAssert.present(source, { status: 404, message: `Data record '${id}' not found` });
    if (authCtx)
      requireEntityAction(
        authCtx,
        source,
        'create_child',
        'You do not have permission to clone this entity'
      );

    const baseName = source.name ? `${source.name} (copy)` : source.slug;
    const baseSlug = slugify(baseName);
    const timestamp = new Date();
    const publicId = await allocateEntityPublicId(db, workspace, source.schema_id, timestamp);
    const row = await db.catalog.createEntity({
      id: randomUUID(),
      workspace,
      public_id: publicId,
      slug: baseSlug,
      namespace: source.namespace,
      name: baseName,
      description: source.description,
      owner: source.owner,
      lifecycle: source.lifecycle,
      target_lifecycle: source.target_lifecycle,
      target_lifecycle_date: source.target_lifecycle_date,
      tags: source.tags,
      links: source.links,
      schema_id: source.schema_id,
      data: source.data,
      project_id: source.project_id,
      created_at: timestamp,
      updated_at: timestamp
    });

    await logAudit(db, {
      workspace,
      userId: actor.id,
      userDisplayName: actor.displayName,
      operation: 'create',
      entityType: 'entity',
      entityId: row.id,
      entityName: row.name,
      entitySlug: row.slug,
      schemaId: row.schema_id,
      changes: { new: flattenEntityAuditFields(row) }
    });

    return toApiEntity(row, authCtx);
  } catch (error) {
    return handleError(error, 'Failed to clone data record');
  }
};

export const deleteEntity = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  authCtx: AuthorizationContext | null,
  actor: EntityMutationActor
): Promise<{ success: boolean; message: string }> => {
  try {
    const row = await db.catalog.getEntity(workspace, id);
    httpAssert.present(row, { status: 404, message: `Data record '${id}' not found` });
    if (authCtx)
      requireEntityAction(
        authCtx,
        row,
        'admin_entity',
        'You do not have permission to delete this entity'
      );

    const watcherUserIds = await db.watch.listWatcherUserIds(workspace, row.id);
    await db.catalog.deleteEntity(workspace, row.id);

    await db.catalog.createSnapshot({
      id: randomUUID(),
      workspace,
      entity_id: row.id,
      status: 'deleted',
      project_id: null,
      target_date: null,
      milestone_id: null,
      commit_message: null,
      created_at: new Date(),
      created_by: actor.id,
      created_by_name: actor.displayName,
      base_state: entityToBaseState(row),
      proposed_state: null
    });

    await logAudit(db, {
      workspace,
      userId: actor.id,
      userDisplayName: actor.displayName,
      watcherUserIds,
      operation: 'delete',
      entityType: 'entity',
      entityId: row.id,
      entityName: row.name,
      entitySlug: row.slug,
      schemaId: row.schema_id,
      changes: { old: flattenEntityAuditFields(row) }
    });

    return { success: true, message: `Data record '${id}' deleted` };
  } catch (error) {
    return handleError(error, 'Failed to delete data record');
  }
};
