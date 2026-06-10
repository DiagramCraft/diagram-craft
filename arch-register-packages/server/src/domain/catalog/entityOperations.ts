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
import {
  handleError,
  parseEntityMutationPayload,
  filterEntities,
  buildEntityRelations,
  resolveCreateOwner,
  getEntityParentsFromPayload,
  getLifecycleValues,
  getTeamIds
} from './dataHelpers';
import {
  EntityFacets,
  EntityRecord,
  EntityRelations,
  TreeResponse
} from '@arch-register/api-types/entityContract';

const checker = new PermissionChecker();

export const listEntities = async (
  db: DatabaseAdapter,
  workspace: string,
  authCtx: AuthorizationContext | null,
  options: {
    schemaId?: string | null;
    owner?: string | null;
    lifecycle?: string | null;
    q?: string | null;
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
    view = 'full',
    limit,
    offset = 0
  } = options;
  try {
    const [allEntities, schemas] = await Promise.all([
      db.catalog.listEntities(workspace),
      db.catalog.listSchemas(workspace)
    ]);
    const schemaMap = new Map(schemas.map(s => [s.id, s]));
    const visibleEntities = allEntities.filter(
      entity => !authCtx || checker.hasEntityPermission(authCtx, entity, 'view_entity')
    );
    const safeOffset = offset ?? 0;
    const rows = filterEntities(visibleEntities, { schemaId, owner, lifecycle, q: q ?? '' })
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(safeOffset, limit != null ? safeOffset + limit : undefined);
    return view === 'summary'
      ? rows.map(row => {
          const schema = schemaMap.get(row.schema_id);
          return toApiEntitySummary(
            row,
            authCtx,
            schema != null ? computeEntityCompleteness(row, schema) : null
          ) as EntityRecord;
        })
      : rows.map(row => {
          const schema = schemaMap.get(row.schema_id);
          return toApiEntity(
            row,
            authCtx,
            schema != null ? computeEntityCompleteness(row, schema) : null
          );
        });
  } catch (error) {
    return handleError(error, 'Failed to retrieve data');
  }
};

export const getEntityFacets = async (
  db: DatabaseAdapter,
  workspace: string,
  authCtx: AuthorizationContext | null
): Promise<EntityFacets> => {
  try {
    const [allEntities, schemas] = await Promise.all([
      db.catalog.listEntities(workspace),
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
  }
): Promise<TreeResponse> => {
  const { schemaId = null, owner = null, lifecycle = null, q = '' } = options;
  try {
    const [schemas, allEntitiesRaw] = await Promise.all([
      db.catalog.listSchemas(workspace),
      db.catalog.listEntities(workspace)
    ]);
    const allEntities = allEntitiesRaw.filter(
      entity => !authCtx || checker.hasEntityPermission(authCtx, entity, 'view_entity')
    );

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

    const matchRows = filterEntities(allEntities, { schemaId, owner, lifecycle, q: q ?? '' }).sort(
      (a, b) => a.name.localeCompare(b.name)
    );
    const matchIds = new Set(matchRows.map(r => r.id));
    const entityById = new Map(allEntities.map(entity => [entity.id, entity]));
    const allIncluded = new Map(matchRows.map(entity => [entity.id, entity]));
    const edges: Array<{ childId: string; parentId: string }> = [];

    let currentLevel = [...matchRows];
    while (currentLevel.length > 0) {
      const nextLevel = [];
      for (const entity of currentLevel) {
        const cFields = containmentFieldsBySchema.get(entity.schema_id) ?? [];
        for (const fieldId of cFields) {
          for (const parentId of entity.data[fieldId]
            ? String(entity.data[fieldId])
                .split(',')
                .map(s => s.trim())
                .filter(Boolean)
            : []) {
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
        ...toApiEntitySummary(row, authCtx),
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
      db.catalog.listEntities(workspace)
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
      db.catalog.listEntities(workspace)
    ]);
    httpAssert.present(schema, {
      status: 404,
      message: `Schema '${payload.schemaId}' not found`
    });
    const entityLookup = new Map(entities.map(entity => [entity.id, entity]));
    const parents = getEntityParentsFromPayload(schema, payload.fields, entityLookup);
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
    const row = await createEntityWithAudit(db, {
      workspace,
      actor,
      entity: {
        id: randomUUID(),
        workspace,
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
        data: payload.fields,
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
    const oldRow = await db.catalog.getEntity(workspace, id);
    httpAssert.present(oldRow, { status: 404, message: `Data record '${id}' not found` });
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

    const row = await updateEntityWithAudit(db, {
      workspace,
      entityId: id,
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
        data: payload.fields,
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
    const row = await db.catalog.createEntity({
      id: randomUUID(),
      workspace,
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

    const watcherUserIds = await db.watch.listWatcherUserIds(workspace, id);
    await db.catalog.deleteEntity(workspace, id);

    await logAudit(db, {
      workspace,
      userId: actor.id,
      userDisplayName: actor.displayName,
      watcherUserIds,
      operation: 'delete',
      entityType: 'entity',
      entityId: id,
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
