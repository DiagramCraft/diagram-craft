import { randomUUID } from 'node:crypto';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import {
  buildApiAuthCtx,
  buildApiEntityAuthCtx,
  requireEntityAction,
  requireWorkspaceCapability
} from '../auth/authorization';
import { httpAssert } from '../../utils/httpAssert';
import type {
  CreateSavedViewRequest,
  UpdateSavedViewRequest,
  SavedView as ApiSavedView
} from '@arch-register/api-types/viewContract';
import { PermissionChecker } from '@arch-register/permissions';
import type { WorkspaceAuthorizationContext } from '@arch-register/permissions';
import type { EntityQuery, PathStep, QueryNode } from '@arch-register/api-types/entityQueryIR';
import type { Entity, SavedViewDbResult, SchemaDbResult } from './db/catalogDatabase';
import type { RelationSchemaDbResult } from './db/relationDatabase';
import { PinnedEntity } from '@arch-register/api-types/watchContract';
import { listAllCatalogEntities } from './entityLoader';
import { isFieldViewRestricted } from '../auth/fieldGroupAccessControl';

const checker = new PermissionChecker();

const PSEUDO_FIELD_IDS = new Set([
  '_id',
  '_schemaId',
  '_lifecycle',
  '_owner',
  '_name',
  '_slug',
  '_description',
  '_namespace',
  '_completeness',
  '_updatedAt',
  '_tags',
  '_assessment'
]);

// Mirrors entityQueryIRValidator.ts's RELATION_PSEUDO_FIELD_IDS.
const RELATION_PSEUDO_FIELD_IDS = new Set([
  '_id',
  '_schemaId',
  '_inEntityId',
  '_outEntityId',
  '_createdAt',
  '_updatedAt'
]);

const fieldIsRestricted = (
  fieldId: string,
  schemas: SchemaDbResult[],
  authCtx: WorkspaceAuthorizationContext,
  schemaId?: string
) => {
  if (PSEUDO_FIELD_IDS.has(fieldId) || fieldId.startsWith('_assessment:')) return false;
  const candidates = schemaId ? schemas.filter(schema => schema.id === schemaId) : schemas;
  return candidates.some(
    schema =>
      schema.fields.some(field => field.id === fieldId) &&
      isFieldViewRestricted(authCtx, schema, fieldId)
  );
};

const relationFieldIsRestricted = (
  fieldId: string,
  relationSchemas: RelationSchemaDbResult[],
  authCtx: WorkspaceAuthorizationContext,
  relationSchemaId: string
) => {
  if (RELATION_PSEUDO_FIELD_IDS.has(fieldId)) return false;
  const schema = relationSchemas.find(candidate => candidate.id === relationSchemaId);
  return (
    !schema?.fields.some(field => field.id === fieldId) ||
    isFieldViewRestricted(authCtx, schema, fieldId)
  );
};

const typedRelationOwnerIsRestricted = (
  step: Extract<PathStep, { kind: 'typedRelation' }>,
  schemas: SchemaDbResult[],
  authCtx: WorkspaceAuthorizationContext
) => {
  if (!Array.isArray(step.ownerSchemaIds) || step.ownerSchemaIds.length === 0) return true;
  const schemaById = new Map(schemas.map(schema => [schema.id, schema]));
  return step.ownerSchemaIds.some(ownerSchemaId => {
    const schema = schemaById.get(ownerSchemaId);
    if (!schema) return true;
    const field = schema.fields.find(
      candidate =>
        candidate.id === step.fieldId &&
        candidate.type === 'typedRelation' &&
        candidate.relationSchemaId === step.relationSchemaId &&
        candidate.direction === step.direction
    );
    return field == null || isFieldViewRestricted(authCtx, schema, field.id);
  });
};

const pathUsesRestrictedField = (
  path: PathStep[],
  schemas: SchemaDbResult[],
  authCtx: WorkspaceAuthorizationContext,
  relationSchemas: RelationSchemaDbResult[]
): boolean =>
  path.some(step => {
    if (step.kind === 'typedRelation') {
      return (
        typedRelationOwnerIsRestricted(step, schemas, authCtx) ||
        (step.filter
          ? nodeUsesRestrictedField(
              step.filter,
              schemas,
              authCtx,
              undefined,
              relationSchemas,
              step.relationSchemaId
            )
          : false)
      );
    }
    // 'endpoint' has no field/ACL of its own to restrict — visibility of the entity it lands on
    // is governed by ordinary entity view permissions, not schema field-group ACL.
    if (step.kind === 'endpoint') return false;
    const stepRestricted =
      step.kind === 'backward'
        ? fieldIsRestricted(step.fieldId, schemas, authCtx, step.ownerSchemaId)
        : fieldIsRestricted(step.fieldId, schemas, authCtx);
    return (
      stepRestricted ||
      (step.filter
        ? nodeUsesRestrictedField(step.filter, schemas, authCtx, undefined, relationSchemas)
        : false)
    );
  });

const nodeUsesRestrictedField = (
  node: QueryNode,
  schemas: SchemaDbResult[],
  authCtx: WorkspaceAuthorizationContext,
  rootSchemaId?: string,
  relationSchemas: RelationSchemaDbResult[] = [],
  currentRelationSchemaId?: string
): boolean => {
  switch (node.kind) {
    case 'and':
    case 'or':
      return node.children.some(child =>
        nodeUsesRestrictedField(
          child,
          schemas,
          authCtx,
          rootSchemaId,
          relationSchemas,
          currentRelationSchemaId
        )
      );
    case 'not':
      return nodeUsesRestrictedField(
        node.child,
        schemas,
        authCtx,
        rootSchemaId,
        relationSchemas,
        currentRelationSchemaId
      );
    case 'predicate': {
      // At the true root (empty path) of a relation-rooted query, `rootSchemaId` names a relation
      // schema rather than an entity schema — resolve the field against relationSchemas there too,
      // same as inside a typedRelation.filter scope (`currentRelationSchemaId`).
      const rootRelationSchemaId =
        node.path.length === 0 && rootSchemaId && relationSchemas.some(s => s.id === rootSchemaId)
          ? rootSchemaId
          : undefined;
      const effectiveRelationSchemaId = currentRelationSchemaId ?? rootRelationSchemaId;
      return (
        (effectiveRelationSchemaId
          ? relationFieldIsRestricted(
              node.fieldId,
              relationSchemas,
              authCtx,
              effectiveRelationSchemaId
            )
          : fieldIsRestricted(
              node.fieldId,
              schemas,
              authCtx,
              node.path.length === 0 ? rootSchemaId : undefined
            )) || pathUsesRestrictedField(node.path, schemas, authCtx, relationSchemas)
      );
    }
    case 'relationExists':
      return pathUsesRestrictedField(node.path, schemas, authCtx, relationSchemas);
    case 'freeText':
      return false;
  }
};

const configUsesRestrictedField = (
  config: unknown,
  schemas: SchemaDbResult[],
  authCtx: WorkspaceAuthorizationContext,
  _relationSchemas: RelationSchemaDbResult[] = []
): boolean => {
  if (config == null || typeof config !== 'object') return false;
  const root = config as Record<string, unknown>;
  const references: Array<{ fieldId: string; schemaId?: string }> = [];
  const addField = (fieldId: unknown, schemaId?: unknown) => {
    if (typeof fieldId === 'string' && fieldId.length > 0) {
      references.push({ fieldId, schemaId: typeof schemaId === 'string' ? schemaId : undefined });
    }
  };
  const addFields = (value: unknown, schemaId?: unknown) => {
    if (Array.isArray(value)) value.forEach(fieldId => addField(fieldId, schemaId));
  };

  if (typeof root.sort === 'string' && root.sort.startsWith('date:')) {
    addField(root.sort.slice('date:'.length));
  }

  for (const key of ['table', 'cards', 'tree', 'explore']) {
    const viewConfig = root[key];
    if (viewConfig && typeof viewConfig === 'object') {
      addFields((viewConfig as Record<string, unknown>).fieldIds);
    }
  }

  const radar = root.radar;
  if (radar && typeof radar === 'object') {
    const value = radar as Record<string, unknown>;
    addField(value.quadrantFieldId, value.schemaId);
    addField(value.ringFieldId, value.schemaId);
    // ringOrder contains the literal values for ringFieldId. Blocking the complete view when
    // that field is restricted prevents those values from becoming an alternate disclosure path.
    if (
      typeof value.ringFieldId === 'string' &&
      fieldIsRestricted(
        value.ringFieldId,
        schemas,
        authCtx,
        typeof value.schemaId === 'string' ? value.schemaId : undefined
      )
    ) {
      return true;
    }
  }

  const timeline = root.timeline;
  if (timeline && typeof timeline === 'object') {
    const value = timeline as Record<string, unknown>;
    addField(value.startFieldId);
    addField(value.endFieldId);
  }

  const matrix = root.matrix;
  if (matrix && typeof matrix === 'object') {
    const value = matrix as Record<string, unknown>;
    addField(value.colEnumFieldId, value.colSchemaId);
  }

  const bubble = root.bubble;
  if (bubble && typeof bubble === 'object') {
    const value = bubble as Record<string, unknown>;
    addField(value.xFieldId);
    addField(value.yFieldId);
    addField(value.sizeFieldId);
    addField(value.colorFieldId);
  }

  const heatmap = root.heatmap;
  if (heatmap && typeof heatmap === 'object') {
    const value = heatmap as Record<string, unknown>;
    addField(value.likelihoodFieldId);
    addField(value.impactFieldId);
    addField(value.colorFieldId);
  }

  const map = root.map;
  if (map && typeof map === 'object') {
    const value = map as Record<string, unknown>;
    addFields(value.fieldIds);
    const metric = value.metricConfig;
    if (metric && typeof metric === 'object') {
      const metricValue = metric as Record<string, unknown>;
      const source = metricValue.source;
      if (source && typeof source === 'object') {
        addField((source as Record<string, unknown>).fieldId, metricValue.sourceSchemaId);
      }
    }
  }

  return references.some(reference =>
    fieldIsRestricted(reference.fieldId, schemas, authCtx, reference.schemaId)
  );
};

export const savedViewUsesRestrictedField = (
  filters: EntityQuery,
  config: unknown,
  schemas: SchemaDbResult[],
  authCtx: WorkspaceAuthorizationContext,
  relationSchemas: RelationSchemaDbResult[] = []
) =>
  nodeUsesRestrictedField(filters.root, schemas, authCtx, filters.schemaId, relationSchemas) ||
  (filters.projections ?? []).some(projection => {
    if (projection.source === 'relation') {
      const step = [...projection.path]
        .reverse()
        .find(candidate => candidate.kind === 'typedRelation');
      return (
        step == null ||
        relationFieldIsRestricted(
          projection.fieldId,
          relationSchemas,
          authCtx,
          step.relationSchemaId
        ) ||
        pathUsesRestrictedField(projection.path, schemas, authCtx, relationSchemas)
      );
    }
    const rootRelationSchemaId =
      projection.path.length === 0 &&
      filters.schemaId &&
      relationSchemas.some(s => s.id === filters.schemaId)
        ? filters.schemaId
        : undefined;
    return (
      (rootRelationSchemaId
        ? relationFieldIsRestricted(
            projection.fieldId,
            relationSchemas,
            authCtx,
            rootRelationSchemaId
          )
        : fieldIsRestricted(
            projection.fieldId,
            schemas,
            authCtx,
            projection.path.length === 0 ? filters.schemaId : undefined
          )) || pathUsesRestrictedField(projection.path, schemas, authCtx, relationSchemas)
    );
  }) ||
  configUsesRestrictedField(config, schemas, authCtx);

// Relation-rooted saved views support the flat table and graph modes. Other views remain
// entity-semantic and don't have a relation-rooted equivalent. Structural constraint, not an ACL
// check, so it applies regardless of authCtx.
const assertRelationRootViewModeAllowed = (
  filters: EntityQuery,
  viewMode: string,
  relationSchemas: RelationSchemaDbResult[]
) => {
  const isRelationRoot =
    filters.root_kind === 'relation' ||
    (filters.schemaId != null && relationSchemas.some(schema => schema.id === filters.schemaId));
  httpAssert.true(!isRelationRoot || viewMode === 'table' || viewMode === 'graph', {
    status: 400,
    message: `Relation-rooted saved views only support the 'table' or 'graph' view modes, got '${viewMode}'`
  });
};

const assertSavedViewAccessible = (
  filters: EntityQuery,
  config: unknown,
  schemas: SchemaDbResult[],
  authCtx: WorkspaceAuthorizationContext,
  relationSchemas: RelationSchemaDbResult[] = []
) => {
  httpAssert.true(
    !savedViewUsesRestrictedField(filters, config, schemas, authCtx, relationSchemas),
    {
      status: 403,
      statusText: 'Forbidden',
      message: 'You do not have permission to access fields used by this saved view'
    }
  );
};

export const toApi = (view: SavedViewDbResult): ApiSavedView => ({
  id: view.id,
  workspaceId: view.workspace,
  scope: view.project_id == null ? 'workspace' : 'project',
  projectId: view.project_id,
  projectScope: view.project_scope,
  name: view.name,
  description: view.description,
  isAdminView: view.is_admin_view,
  viewMode: view.view_mode,
  filters: view.filters,
  config: view.config,
  createdAt: view.created_at.toISOString(),
  updatedAt: view.updated_at.toISOString()
});

const canAccessPinnedEntity = (
  authCtx: Awaited<ReturnType<typeof buildApiEntityAuthCtx>>,
  entityMap: Map<string, Entity>,
  entityId: string
) => {
  const entity = entityMap.get(entityId);
  if (entity == null) return false;
  return checker.hasEntityPermission(authCtx, entity, 'view_entity');
};

export const listSavedViews = async (
  db: DatabaseAdapter,
  workspace: string,
  options?: {
    projectId?: string | null;
    includeWorkspace?: boolean;
    authCtx?: WorkspaceAuthorizationContext;
  }
): Promise<ApiSavedView[]> => {
  const views = await db.view.listSavedViews(workspace, options);
  if (!options?.authCtx) return views.map(toApi);
  const [schemas, relationSchemas] = await Promise.all([
    db.catalog.listSchemas(workspace),
    db.relation.listRelationSchemas(workspace)
  ]);
  return views
    .filter(
      view =>
        !savedViewUsesRestrictedField(
          view.filters,
          view.config,
          schemas,
          options.authCtx!,
          relationSchemas
        )
    )
    .map(toApi);
};

export const createSavedView = async (
  db: DatabaseAdapter,
  workspace: string,
  body: CreateSavedViewRequest,
  authCtx?: WorkspaceAuthorizationContext
): Promise<ApiSavedView> => {
  httpAssert.true(body.name, { status: 400, message: 'Name is required' });
  httpAssert.true(body.viewMode, { status: 400, message: 'viewMode is required' });
  httpAssert.true(body.filters, { status: 400, message: 'filters is required' });
  const scope = body.scope ?? 'workspace';
  const projectId = scope === 'project' ? (body.projectId ?? null) : null;

  httpAssert.true(scope === 'workspace' || projectId != null, {
    status: 400,
    message: 'projectId is required for project-scoped views'
  });

  {
    const relationSchemas = await db.relation.listRelationSchemas(workspace);
    assertRelationRootViewModeAllowed(body.filters, body.viewMode, relationSchemas);
    if (authCtx) {
      const schemas = await db.catalog.listSchemas(workspace);
      assertSavedViewAccessible(
        body.filters,
        body.config ?? null,
        schemas,
        authCtx,
        relationSchemas
      );
    }
  }

  const now = new Date();
  const view = await db.view.createSavedView({
    id: randomUUID(),
    workspace,
    project_id: projectId,
    project_scope: body.projectScope ?? null,
    name: body.name,
    description: body.description ?? null,
    is_admin_view: body.isAdminView ?? false,
    view_mode: body.viewMode,
    filters: body.filters,
    config: body.config ?? null,
    created_at: now,
    updated_at: now
  });

  return toApi(view);
};

export const updateSavedView = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  body: UpdateSavedViewRequest,
  authCtx?: WorkspaceAuthorizationContext
): Promise<ApiSavedView> => {
  httpAssert.true(id, { status: 400, message: 'ID is required' });

  const existing = await db.view.getSavedView(workspace, id);
  httpAssert.true(existing, { status: 404, message: 'View not found' });

  {
    const relationSchemas = await db.relation.listRelationSchemas(workspace);
    assertRelationRootViewModeAllowed(
      body.filters ?? existing.filters,
      body.viewMode ?? existing.view_mode,
      relationSchemas
    );
    if (authCtx) {
      const schemas = await db.catalog.listSchemas(workspace);
      assertSavedViewAccessible(
        body.filters ?? existing.filters,
        body.config === undefined ? existing.config : body.config,
        schemas,
        authCtx,
        relationSchemas
      );
    }
  }

  const updated = await db.view.updateSavedView(workspace, id, {
    name: body.name,
    description: body.description,
    is_admin_view: body.isAdminView,
    view_mode: body.viewMode,
    filters: body.filters,
    config: body.config,
    project_scope: body.projectScope,
    updated_at: new Date()
  });

  httpAssert.true(updated, { status: 404, message: 'View not found' });
  return toApi(updated!);
};

export const deleteSavedView = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string
): Promise<{ success: boolean }> => {
  httpAssert.true(id, { status: 400, message: 'ID is required' });

  const deleted = await db.view.deleteSavedView(workspace, id);
  httpAssert.true(deleted, { status: 404, message: 'View not found' });

  return { success: true };
};

export const listPinnedEntities = async (
  db: DatabaseAdapter,
  workspace: string,
  event: AuthenticatedEvent
): Promise<PinnedEntity[]> => {
  const authCtx = await buildApiEntityAuthCtx(db, workspace, event);
  requireWorkspaceCapability(authCtx, 'ws.view');

  const userId = event.context.user.id;
  const [pins, entities] = await Promise.all([
    db.catalog.listPinnedEntities(userId, workspace),
    listAllCatalogEntities(db, workspace)
  ]);
  const entityMap = new Map(entities.map(entity => [entity.id, entity]));

  return pins
    .map(pin => {
      const entity = entityMap.get(pin.entity_id);
      if (!entity) return null;
      if (!canAccessPinnedEntity(authCtx, entityMap, pin.entity_id)) return null;
      return {
        entity_id: entity.id,
        entity_public_id: entity.public_id ?? entity.id,
        entity_name: entity.name,
        entity_slug: entity.slug,
        schema_id: entity.schema_id,
        created_at: pin.created_at.toISOString()
      };
    })
    .filter((item): item is PinnedEntity => item != null);
};

export const createPinnedEntity = async (
  db: DatabaseAdapter,
  workspace: string,
  entityId: string,
  event: AuthenticatedEvent
): Promise<PinnedEntity> => {
  const authCtx = await buildApiEntityAuthCtx(db, workspace, event);
  requireWorkspaceCapability(authCtx, 'ws.view');

  const entity = await db.catalog.getEntity(workspace, entityId);
  httpAssert.present(entity, { status: 404, message: `Entity '${entityId}' not found` });
  requireEntityAction(authCtx, entity, 'view_entity', 'You do not have access to pin this entity');

  const pin = await db.catalog.createPinnedEntity({
    user_id: event.context.user.id,
    workspace,
    entity_id: entity.id,
    created_at: new Date()
  });

  return {
    entity_id: entity.id,
    entity_public_id: entity.public_id ?? entity.id,
    entity_name: entity.name,
    entity_slug: entity.slug,
    schema_id: entity.schema_id,
    created_at: pin.created_at.toISOString()
  };
};

export const deletePinnedEntity = async (
  db: DatabaseAdapter,
  workspace: string,
  entityId: string,
  event: AuthenticatedEvent
): Promise<{ success: boolean; message: string }> => {
  const authCtx = await buildApiAuthCtx(db, workspace, event);
  requireWorkspaceCapability(authCtx, 'ws.view');

  const entity = await db.catalog.getEntity(workspace, entityId);
  httpAssert.present(entity, { status: 404, message: `Entity '${entityId}' not found` });
  await db.catalog.deletePinnedEntity(event.context.user.id, workspace, entity.id);

  return { success: true, message: `Entity '${entityId}' unpinned` };
};
