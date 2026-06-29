import { randomUUID } from 'node:crypto';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthorizationContext } from '@arch-register/permissions';
import { PermissionChecker } from '@arch-register/permissions';
import { slugify } from '../../utils/http';
import { httpAssert } from '../../utils/httpAssert';
import { computeEntityCompleteness } from '../../utils/completeness';
import { requireEntityAction, requireCanCreateTopLevelEntity } from '../auth/authorization';
import type { EntityMutationActor } from './entityMutations';
import { createEntityWithAudit, updateEntityWithAudit } from './entityMutations';
import { logAudit, flattenEntityAuditFields } from '../audit/db/auditLogging';
import { toApiEntity, toApiEntitySummary } from './entityHelpers';
import { decodeRefs } from '../../types';
import {
  handleError,
  parseEntityMutationPayload,
  filterEntities,
  matchesFilterCondition,
  buildEntityRelations,
  resolveCreateOwner,
  getEntityParentsFromPayload,
  getLifecycleValues,
  getTeamIds,
  normalizeEntityRelationFields
} from './dataHelpers';
import { formatPublicId } from '../../utils/publicIds';
import { ENTITY_DEFAULTS } from '../../constants';
import {
  EntityFacets,
  EntityRecord,
  EntityRelations,
  TreeResponse
} from '@arch-register/api-types/entityContract';
import type { FilterCondition } from '@arch-register/api-types/viewContract';
import { listAllCatalogEntities } from './entityLoader';

const checker = new PermissionChecker();

type CollectedEntity = {
  entity: EntityRecord;
  completeness: number | null;
};

const attachProjectLink = (
  entity: EntityRecord,
  rowId: string,
  projectId: string | null,
  projectEntityMap: Map<string, { entity_type_id: string | null; entity_type_label: string | null; is_done: boolean }>
): EntityRecord => {
  if (!projectId) return entity;
  const projectEntity = projectEntityMap.get(rowId);
  return {
    ...entity,
    _projectLink: projectEntity
      ? {
          linked: true,
          entityType: projectEntity.entity_type_id
            ? { id: projectEntity.entity_type_id, name: projectEntity.entity_type_label ?? projectEntity.entity_type_id }
            : null,
          isDone: projectEntity.is_done
        }
      : { linked: false, entityType: null, isDone: false }
  };
};

const allocateEntityPublicId = async (
  db: DatabaseAdapter,
  workspace: string,
  schemaId: string,
  timestamp: Date
) => {
  const schema = await db.catalog.getSchema(workspace, schemaId);
  httpAssert.present(schema, { status: 404, message: `Schema '${schemaId}' not found` });
  httpAssert.present(schema.key_prefix, { status: 409, message: `Schema '${schemaId}' is missing a key prefix` });
  const sequenceNumber = await db.workspace.allocatePublicId(schema.key_prefix, timestamp);
  return formatPublicId(schema.key_prefix, sequenceNumber);
};

export const listEntities = async (
  db: DatabaseAdapter,
  workspace: string,
  authCtx: AuthorizationContext | null,
  options: {
    schemaId?: string | null;
    owner?: string | null;
    lifecycle?: string | null;
    q?: string | null;
    conditions?: FilterCondition[];
    projectId?: string | null;
    projectScope?: 'project' | 'all';
    view?: 'summary' | 'full';
    limit?: number | null;
    offset?: number | null;
  }
): Promise<EntityRecord[]> => {
  const {
    schemaId = null,
    owner = null,
    lifecycle = null,
    q = '',
    conditions = [],
    projectId = null,
    projectScope = 'all',
    view = 'full',
    limit,
    offset = 0
  } = options;
  const safeOffset = Math.max(Math.trunc(offset ?? 0), 0);
  const safeLimit = limit == null ? null : Math.max(Math.trunc(limit), 1);
  try {
    const rows = await collectEntities(db, workspace, authCtx, {
      schemaId,
      owner,
      lifecycle,
      q,
      conditions,
      projectId,
      projectScope,
      view
    });
    const windowed =
      safeLimit != null ? rows.slice(safeOffset, safeOffset + safeLimit) : rows.slice(safeOffset);
    return windowed.map(row => row.entity);
  } catch (error) {
    return handleError(error, 'Failed to retrieve data');
  }
};

export const countEntities = async (
  db: DatabaseAdapter,
  workspace: string,
  authCtx: AuthorizationContext | null,
  options: {
    schemaId?: string | null;
    owner?: string | null;
    lifecycle?: string | null;
    q?: string | null;
    conditions?: FilterCondition[];
    projectId?: string | null;
    projectScope?: 'project' | 'all';
  }
): Promise<number> => {
  const rows = await collectEntities(db, workspace, authCtx, {
    schemaId: options.schemaId ?? null,
    owner: options.owner ?? null,
    lifecycle: options.lifecycle ?? null,
    q: options.q ?? '',
    conditions: options.conditions ?? [],
    projectId: options.projectId ?? null,
    projectScope: options.projectScope ?? 'all',
    view: 'full'
  });
  return rows.length;
};

const collectEntities = async (
  db: DatabaseAdapter,
  workspace: string,
  authCtx: AuthorizationContext | null,
  options: {
    schemaId?: string | null;
    owner?: string | null;
    lifecycle?: string | null;
    q?: string | null;
    conditions?: FilterCondition[];
    projectId?: string | null;
    projectScope?: 'project' | 'all';
    view?: 'summary' | 'full';
  }
): Promise<CollectedEntity[]> => {
  const {
    schemaId = null,
    owner = null,
    lifecycle = null,
    q = '',
    conditions = [],
    projectId = null,
    projectScope = 'all',
    view = 'full'
  } = options;
  // _completeness is computed post-fetch; all other conditions can be evaluated in SQL
  const sqlConditions = conditions.filter(c => c.fieldId !== '_completeness');
  const completenessConditions = conditions.filter(c => c.fieldId === '_completeness');
  const [schemas, projectEntities] = await Promise.all([
    db.catalog.listSchemas(workspace),
    projectId ? db.project.listProjectEntities(workspace, projectId) : Promise.resolve([])
  ]);
  const schemaMap = new Map(schemas.map(s => [s.id, s]));
  const projectEntityMap = new Map(projectEntities.map(entity => [entity.entity_id, entity]));
  const rows: CollectedEntity[] = [];
  const dbPageSize = ENTITY_DEFAULTS.PAGE_SIZE;
  let dbOffset = 0;

  while (true) {
    const page = await db.catalog.listEntitiesPaginated(
      workspace,
      {
        schemaId,
        owner,
        lifecycle,
        q: q ?? '',
        conditions: sqlConditions
      },
      {
        limit: dbPageSize,
        offset: dbOffset
      }
    );

    if (page.length === 0) break;

    for (const entity of page) {
      if (authCtx && !checker.hasEntityPermission(authCtx, entity, 'view_entity')) continue;
      if (projectId && projectScope === 'project' && !projectEntityMap.has(entity.id)) continue;

      const schema = schemaMap.get(entity.schema_id);
      const completeness = schema != null ? computeEntityCompleteness(entity, schema) : null;
      if (
        completenessConditions.length > 0 &&
        !completenessConditions.every(c => matchesFilterCondition(entity, c, completeness))
      ) {
        continue;
      }

      rows.push({
        entity:
          view === 'summary'
            ? (attachProjectLink(
                toApiEntitySummary(entity, authCtx, completeness) as EntityRecord,
                entity.id,
                projectId,
                projectEntityMap
              ) as EntityRecord)
            : attachProjectLink(
                toApiEntity(entity, authCtx, completeness),
                entity.id,
                projectId,
                projectEntityMap
              ),
        completeness
      });
    }

    if (page.length < dbPageSize) break;
    dbOffset += dbPageSize;
  }

  return rows;
};

export const getEntityFacets = async (
  db: DatabaseAdapter,
  workspace: string,
  authCtx: AuthorizationContext | null
): Promise<EntityFacets> => {
  try {
    const [allEntities, schemas] = await Promise.all([
      listAllCatalogEntities(db, workspace),
      db.catalog.listSchemas(workspace)
    ]);
    const schemaMap = new Map(schemas.map(s => [s.id, s]));
    const entities = allEntities.filter(
      entity => !authCtx || checker.hasEntityPermission(authCtx, entity, 'view_entity')
    );

    const countBy = <T extends string | null>(values: T[]) =>
      [
        ...values
          .reduce((acc, value) => acc.set(value, (acc.get(value) ?? 0) + 1), new Map<T, number>())
          .entries()
      ]
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count || String(a.value).localeCompare(String(b.value)));

    const completenessScores = entities.map(entity => {
      const schema = schemaMap.get(entity.schema_id);
      return schema ? computeEntityCompleteness(entity, schema) : null;
    });
    const scored = completenessScores.filter((s): s is number => s !== null);
    const completeness = {
      below50: scored.filter(s => s < 50).length,
      below80: scored.filter(s => s >= 50 && s < 80).length,
      above80: scored.filter(s => s >= 80).length
    };

    const ownerLabelMap = new Map(
      entities.filter(e => e.owner != null).map(e => [e.owner!, e.owner_name ?? e.owner!])
    );
    const lifecycleLabelMap = new Map(
      entities
        .filter(e => e.lifecycle != null)
        .map(e => [e.lifecycle!, e.lifecycle_label ?? e.lifecycle!])
    );

    return {
      total: entities.length,
      lifecycle: countBy(entities.map(entity => entity.lifecycle)).map(({ value, count }) => ({
        value,
        label: value != null ? (lifecycleLabelMap.get(value) ?? value) : '',
        count
      })),
      owner: countBy(entities.map(entity => entity.owner)).map(({ value, count }) => ({
        value,
        label: value != null ? (ownerLabelMap.get(value) ?? value) : '',
        count
      })),
      schema: countBy(entities.map(entity => entity.schema_id)).map(({ value, count }) => ({
        schemaId: value!,
        count
      })),
      completeness
    };
  } catch (error) {
    return handleError(error, 'Failed to retrieve data facets');
  }
};

export const getEntityTree = async (
  db: DatabaseAdapter,
  workspace: string,
  authCtx: AuthorizationContext | null,
  options: {
    schemaId?: string | null;
    owner?: string | null;
    lifecycle?: string | null;
    q?: string | null;
    projectId?: string | null;
    projectScope?: 'project' | 'all';
  }
): Promise<TreeResponse> => {
  const {
    schemaId = null,
    owner = null,
    lifecycle = null,
    q = '',
    projectId = null,
    projectScope = 'all'
  } = options;
  try {
    const [schemas, allEntitiesRaw, projectEntities] = await Promise.all([
      db.catalog.listSchemas(workspace),
      listAllCatalogEntities(db, workspace),
      projectId ? db.project.listProjectEntities(workspace, projectId) : Promise.resolve([])
    ]);
    const projectEntityMap = new Map(projectEntities.map(entity => [entity.entity_id, entity]));
    const allEntities = allEntitiesRaw.filter(
      entity => !authCtx || checker.hasEntityPermission(authCtx, entity, 'view_entity')
    );
    const scopedEntities =
      projectId && projectScope === 'project'
        ? allEntities.filter(entity => projectEntityMap.has(entity.id))
        : allEntities;

    const containmentFieldsBySchema = new Map<string, string[]>();
    for (const schema of schemas) {
      const cFields = schema.fields
        .filter(
          (f): f is Extract<(typeof schema.fields)[number], { type: 'containment' }> =>
            f.type === 'containment'
        )
        .map(f => f.id);
      if (cFields.length > 0) containmentFieldsBySchema.set(schema.id, cFields);
    }

    const matchRows = filterEntities(scopedEntities, {
      schemaId,
      owner,
      lifecycle,
      q: q ?? ''
    }).sort((a, b) => a.name.localeCompare(b.name));
    const matchIds = new Set(matchRows.map(r => r.id));
    const entityById = new Map(scopedEntities.map(entity => [entity.id, entity]));
    const allIncluded = new Map(matchRows.map(entity => [entity.id, entity]));
    const edges: Array<{ childId: string; parentId: string }> = [];

    let currentLevel = [...matchRows];
    while (currentLevel.length > 0) {
      const nextLevel = [];
      for (const entity of currentLevel) {
        const cFields = containmentFieldsBySchema.get(entity.schema_id) ?? [];
        for (const fieldId of cFields) {
          for (const parentId of decodeRefs(entity.data[fieldId])) {
            edges.push({ childId: entity.id, parentId });
            const parent = entityById.get(parentId);
            if (parent && !allIncluded.has(parent.id)) {
              allIncluded.set(parent.id, parent);
              nextLevel.push(parent);
            }
          }
        }
      }
      currentLevel = nextLevel;
    }

    return {
      nodes: [...allIncluded.values()].map(row => ({
        ...attachProjectLink(toApiEntitySummary(row, authCtx) as EntityRecord, row.id, projectId, projectEntityMap),
        _isMatch: matchIds.has(row.id)
      })),
      edges
    };
  } catch (error) {
    return handleError(error, 'Failed to build tree data');
  }
};

export const getEntity = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  authCtx: AuthorizationContext | null
): Promise<EntityRecord> => {
  try {
    const [row, schemas] = await Promise.all([
      db.catalog.getEntity(workspace, id),
      db.catalog.listSchemas(workspace)
    ]);
    httpAssert.present(row, { status: 404, message: `Data record '${id}' not found` });
    if (authCtx)
      requireEntityAction(
        authCtx,
        row,
        'view_entity',
        'You do not have access to view this entity'
      );
    const schema = schemas.find(s => s.id === row.schema_id);
    return toApiEntity(
      row,
      authCtx,
      schema != null ? computeEntityCompleteness(row, schema) : null
    );
  } catch (error) {
    return handleError(error, 'Failed to retrieve data record');
  }
};

export const getEntityRelations = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  authCtx: AuthorizationContext | null
): Promise<EntityRelations> => {
  try {
    const [entity, schemas, entitiesRaw] = await Promise.all([
      db.catalog.getEntity(workspace, id),
      db.catalog.listSchemas(workspace),
      listAllCatalogEntities(db, workspace)
    ]);
    httpAssert.present(entity, { status: 404, message: `Data record '${id}' not found` });
    if (authCtx)
      requireEntityAction(
        authCtx,
        entity,
        'view_entity',
        'You do not have access to view this entity'
      );
    const entities = authCtx
      ? entitiesRaw.filter(row => checker.hasEntityPermission(authCtx, row, 'view_entity'))
      : entitiesRaw;
    return buildEntityRelations(entity, schemas, entities);
  } catch (error) {
    return handleError(error, 'Failed to retrieve data relations');
  }
};

export const getBatchEntityRelations = async (
  db: DatabaseAdapter,
  workspace: string,
  ids: string[],
  authCtx: AuthorizationContext | null
): Promise<Record<string, EntityRelations>> => {
  try {
    const [schemas, entitiesRaw] = await Promise.all([
      db.catalog.listSchemas(workspace),
      listAllCatalogEntities(db, workspace)
    ]);
    const entities = authCtx
      ? entitiesRaw.filter(row => checker.hasEntityPermission(authCtx, row, 'view_entity'))
      : entitiesRaw;
    const entityLookup = new Map(entities.map(e => [e.id, e]));
    const result: Record<string, EntityRelations> = {};
    for (const id of ids) {
      const entity = entityLookup.get(id);
      if (!entity) continue;
      result[id] = buildEntityRelations(entity, schemas, entities);
    }
    return result;
  } catch (error) {
    return handleError(error, 'Failed to retrieve batch entity relations');
  }
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
        visibility_mode: payload.visibilityMode,
        created_at: timestamp,
        updated_at: timestamp
      }
    });

    return toApiEntity(row, authCtx);
  } catch (error) {
    return handleError(error, 'Failed to create data record');
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
    if (authCtx)
      requireEntityAction(
        authCtx,
        oldRow,
        'edit_entity',
        'You do not have permission to edit this entity'
      );
    if (authCtx && (owner !== oldRow.owner || payload.visibilityMode !== oldRow.visibility_mode)) {
      requireEntityAction(
        authCtx,
        oldRow,
        'admin_entity',
        'You do not have permission to change ownership or visibility'
      );
    }

    const normalizedFields = normalizeEntityRelationFields({
      schema,
      fields: payload.fields,
      entities
    });

    const row = await updateEntityWithAudit(db, {
      workspace,
      entityId: oldRow.id,
      previous: oldRow,
      actor,
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
        visibility_mode: payload.visibilityMode,
        updated_at: new Date()
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
      visibility_mode: source.visibility_mode,
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
