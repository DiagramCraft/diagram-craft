import { createHash, randomUUID } from 'node:crypto';
import type { AuthorizationContext } from '@arch-register/permissions';
import { PermissionChecker } from '@arch-register/permissions';
import type {
  Baseline,
  BaselineDetail,
  BaselineScope,
  CreateBaselineRequest
} from '@arch-register/api-types/baselineContract';
import type { EntityQuery } from '@arch-register/api-types/entityQueryIR';
import type { EntityRecord, EntityLandscapeDiff } from '@arch-register/api-types/entityContract';
import type { RelationRecord } from '@arch-register/api-types/relationContract';
import type { DatabaseAdapter } from '../../db/database';
import type {
  BaselineDbResult,
  BaselineLinkDbResult,
  BaselineLinkTargetType,
  BaselineRecordDbCreate
} from './db/baselineDatabase';
import type { EntityDbResult, SchemaDbResult } from '../catalog/db/catalogDatabase';
import type { RelationDbResult, RelationSchemaDbResult } from '../catalog/db/relationDatabase';
import { httpAssert } from '../../utils/httpAssert';
import {
  filterVisibleEntities,
  requireProjectAction,
  requireProjectAccess,
  requireWorkspaceCapability
} from '../auth/authorization';
import { listAllCatalogEntities } from '../catalog/entityLoader';
import { reconstructEntitiesAsOf } from '../catalog/entitySnapshotReconstruction';
import { reconstructRelationsAsOf } from '../catalog/relationSnapshotReconstruction';
import {
  resolveEntitySchemaCatalogAt,
  resolveRelationSchemaCatalogAt
} from '../catalog/schemaHistory';
import { listEntitiesWithCount } from '../catalog/entityQueryOperations';
import { buildDiff, redactKnownDataDiff } from '../catalog/entityDiff';
import { toApiHistoricalEntity } from '../catalog/entityHelpers';
import { canViewTypedRelation } from '../catalog/relationAccessControl';
import { toRedactedApiRelation } from '../catalog/relationHelpers';
import { computeEntityCompleteness } from '../../utils/completeness';

const checker = new PermissionChecker();

type MaterializationSpec = {
  scope: BaselineScope;
  query: EntityQuery | null;
  effectiveAt: Date;
  includePlannedChanges: boolean;
  includeOverdueChanges: boolean;
};

type Snapshot = {
  entities: EntityDbResult[];
  relations: RelationDbResult[];
  entitySchemas: Map<string, SchemaDbResult | null>;
  relationSchemas: Map<string, RelationSchemaDbResult | null>;
};

const entityDiffState = (entity: EntityDbResult): Record<string, unknown> => ({
  slug: entity.slug,
  namespace: entity.namespace,
  name: entity.name,
  description: entity.description,
  owner: entity.owner,
  lifecycle: entity.lifecycle,
  target_lifecycle: entity.target_lifecycle,
  target_lifecycle_date: entity.target_lifecycle_date,
  tags: entity.tags,
  links: entity.links,
  schema_id: entity.schema_id,
  data: entity.data,
  project_id: entity.project_id
});

const relationDiffState = (relation: RelationDbResult): Record<string, unknown> => ({
  schema_id: relation.schema_id,
  data: relation.data
});

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value != null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalize(child)])
    );
  }
  return value;
};

const hashState = (state: Record<string, unknown>) =>
  createHash('sha256').update(JSON.stringify(canonicalize(state))).digest('hex');

const dateValue = (value: unknown, fallback = new Date()) =>
  value instanceof Date ? value : new Date(String(value ?? fallback.toISOString()));

const deserializeEntity = (state: Record<string, unknown>): EntityDbResult => {
  const row = { ...state } as unknown as EntityDbResult;
  row.created_at = dateValue(state['created_at']);
  row.updated_at = dateValue(state['updated_at']);
  if (row.last_attested_at != null) row.last_attested_at = dateValue(row.last_attested_at);
  row.tags ??= [];
  row.links ??= [];
  row.data ??= {};
  row.generated_metadata ??= {};
  row.completeness ??= 0;
  row.owner_name ??= row.owner;
  row.lifecycle_label ??= row.lifecycle;
  row.target_lifecycle_label ??= row.target_lifecycle;
  row.schema_name ??= row.schema_id;
  return row;
};

const deserializeRelation = (state: Record<string, unknown>): RelationDbResult => {
  const row = { ...state } as unknown as RelationDbResult;
  row.created_at = dateValue(state['created_at']);
  row.updated_at = dateValue(state['updated_at']);
  row.data ??= {};
  row.owner_name ??= row.owner;
  row.schema_name ??= row.schema_id;
  row.in_entity_name ??= row.in_entity_id;
  row.out_entity_name ??= row.out_entity_id;
  row.version ??= 1;
  return row;
};

const asSchema = (value: Record<string, unknown> | null): SchemaDbResult | null =>
  value as SchemaDbResult | null;

const asRelationSchema = (
  value: Record<string, unknown> | null
): RelationSchemaDbResult | null => value as RelationSchemaDbResult | null;

const requireWorkspaceView = (authCtx: AuthorizationContext) =>
  requireWorkspaceCapability(authCtx, 'ws.view');

const ensureScopeAccess = async (
  db: DatabaseAdapter,
  workspace: string,
  scope: BaselineScope,
  authCtx: AuthorizationContext
) => {
  requireWorkspaceView(authCtx);
  if (scope.kind === 'project') {
    const project = await db.project.getProject(workspace, scope.projectId);
    httpAssert.present(project, {
      status: 404,
      message: `Project '${scope.projectId}' not found`
    });
    requireProjectAccess(authCtx, project.owner);
    return project;
  }
  if (scope.kind === 'saved_view') {
    const view = await db.view.getSavedView(workspace, scope.viewId);
    httpAssert.present(view, { status: 404, message: 'Saved view not found' });
    if (view.project_id != null) {
      const project = await db.project.getProject(workspace, view.project_id);
      httpAssert.present(project, { status: 404, message: 'Saved view project not found' });
      requireProjectAccess(authCtx, project.owner);
      return project;
    }
  }
  return null;
};

const resolveProjectCandidates = async (
  db: DatabaseAdapter,
  workspace: string,
  projectId: string,
  projectScope: 'project' | 'all'
) => {
  if (projectScope === 'all') return undefined;
  const [projectEntities, links] = await Promise.all([
    listAllCatalogEntities(db, workspace, { projectId, projectScope: 'project' }),
    db.project.listProjectEntityLinks(workspace, projectId)
  ]);
  return [
    ...new Set([...projectEntities.map(entity => entity.id), ...links.map(link => link.entity_id)])
  ];
};

const resolveSavedViewCandidates = async (
  db: DatabaseAdapter,
  workspace: string,
  authCtx: AuthorizationContext,
  query: EntityQuery,
  effectiveAt: Date,
  includePlannedChanges: boolean
) => {
  const result = await listEntitiesWithCount(db, workspace, authCtx, {
    entityQuery: {
      ...query,
      asOf: effectiveAt.toISOString(),
      includePlannedChanges
    },
    limit: null,
    offset: 0,
    view: 'full'
  });
  return result.items.map(item => item._uid);
};

const resolveSavedViewQuery = async (
  db: DatabaseAdapter,
  workspace: string,
  scope: BaselineScope
) => {
  if (scope.kind !== 'saved_view') return null;
  const view = await db.view.getSavedView(workspace, scope.viewId);
  httpAssert.present(view, { status: 404, message: 'Saved view not found' });
  return view.filters;
};

const materialize = async (
  db: DatabaseAdapter,
  workspace: string,
  authCtx: AuthorizationContext,
  spec: MaterializationSpec
): Promise<Snapshot> => {
  const project =
    spec.scope.kind === 'project'
      ? await db.project.getProject(workspace, spec.scope.projectId)
      : spec.scope.kind === 'saved_view'
        ? (await db.view.getSavedView(workspace, spec.scope.viewId))?.project_id
          ? await db.project.getProject(
              workspace,
              (await db.view.getSavedView(workspace, spec.scope.viewId))!.project_id!
            )
          : null
        : null;

  const query = spec.query ?? (await resolveSavedViewQuery(db, workspace, spec.scope));
  const candidateEntityIds =
    spec.scope.kind === 'selection'
      ? spec.scope.entityIds
      : spec.scope.kind === 'project'
        ? await resolveProjectCandidates(db, workspace, spec.scope.projectId, spec.scope.projectScope)
        : query
          ? await resolveSavedViewCandidates(
              db,
              workspace,
              authCtx,
              query,
              spec.effectiveAt,
              spec.includePlannedChanges
            )
          : undefined;

  const schemas = await db.catalog.listSchemas(workspace);
  const entitySchemas = await resolveEntitySchemaCatalogAt(
    db,
    workspace,
    schemas,
    spec.effectiveAt
  );
  const reconstructed = await reconstructEntitiesAsOf(
    db,
    workspace,
    spec.effectiveAt,
    authCtx,
    candidateEntityIds,
    spec.includePlannedChanges,
    project?.id,
    spec.includeOverdueChanges ? undefined : new Date()
  );

  const links =
    spec.scope.kind === 'project'
      ? await db.project.listProjectEntityLinks(workspace, spec.scope.projectId)
      : [];
  const linkIds = new Set(links.map(link => link.entity_id));
  const scopedEntities = reconstructed.filter(entity => {
    if (spec.scope.kind !== 'project') return true;
    if (spec.scope.projectScope === 'project') {
      return entity.project_id === spec.scope.projectId || linkIds.has(entity.id);
    }
    return entity.project_id == null || entity.project_id === spec.scope.projectId;
  });
  const entities = filterVisibleEntities(authCtx, scopedEntities);
  const entityIds = new Set(entities.map(entity => entity.id));

  const relationSchemas = await db.relation.listRelationSchemas(workspace);
  const historicalRelationSchemas = await resolveRelationSchemaCatalogAt(
    db,
    workspace,
    relationSchemas,
    spec.effectiveAt
  );
  const allRelations = await reconstructRelationsAsOf(
    db,
    workspace,
    spec.effectiveAt,
    authCtx,
    undefined,
    spec.includePlannedChanges,
    project?.id,
    spec.includeOverdueChanges ? undefined : new Date()
  );
  const entityById = new Map(entities.map(entity => [entity.id, entity]));
  const relations = allRelations.filter(relation => {
    if (!entityIds.has(relation.in_entity_id) || !entityIds.has(relation.out_entity_id)) return false;
    const inEntity = entityById.get(relation.in_entity_id)!;
    const outEntity = entityById.get(relation.out_entity_id)!;
    const inSchema = entitySchemas.get(inEntity.schema_id) ?? null;
    const outSchema = entitySchemas.get(outEntity.schema_id) ?? null;
    return canViewTypedRelation(
      authCtx,
      [
        { schema: inSchema, direction: 'in' },
        { schema: outSchema, direction: 'out' }
      ],
      relation.schema_id,
      relation.owner
    );
  });

  return {
    entities,
    relations,
    entitySchemas,
    relationSchemas: historicalRelationSchemas
  };
};

const storedSnapshot = async (
  db: DatabaseAdapter,
  workspace: string,
  baselineId: string,
  authCtx: AuthorizationContext
): Promise<Snapshot> => {
  const records = await db.baseline.listBaselineRecords(workspace, baselineId);
  const allEntities = records
    .filter(record => record.record_kind === 'entity')
    .map(record => deserializeEntity(record.state));
  const entities = filterVisibleEntities(authCtx, allEntities);
  const entityIds = new Set(entities.map(entity => entity.id));
  const entitySchemas = new Map<string, SchemaDbResult | null>();
  for (const record of records.filter(record => record.record_kind === 'entity')) {
    const entity = deserializeEntity(record.state);
    if (!entitySchemas.has(entity.schema_id)) entitySchemas.set(entity.schema_id, asSchema(record.schema));
  }

  const relationSchemas = new Map<string, RelationSchemaDbResult | null>();
  const relations = records
    .filter(record => record.record_kind === 'relation')
    .map(record => deserializeRelation(record.state))
    .filter(relation => {
      if (!entityIds.has(relation.in_entity_id) || !entityIds.has(relation.out_entity_id)) return false;
      const inEntity = entities.find(entity => entity.id === relation.in_entity_id)!;
      const outEntity = entities.find(entity => entity.id === relation.out_entity_id)!;
      const inSchema = entitySchemas.get(inEntity.schema_id) ?? null;
      const outSchema = entitySchemas.get(outEntity.schema_id) ?? null;
      const record = records.find(
        candidate => candidate.record_kind === 'relation' && candidate.record_id === relation.id
      );
      const relationSchema = asRelationSchema(record?.schema ?? null);
      relationSchemas.set(relation.schema_id, relationSchema);
      return canViewTypedRelation(
        authCtx,
        [
          { schema: inSchema, direction: 'in' },
          { schema: outSchema, direction: 'out' }
        ],
        relation.schema_id,
        relation.owner
      );
    });

  return { entities, relations, entitySchemas, relationSchemas };
};

const makeRecordInputs = (
  workspace: string,
  baselineId: string,
  snapshot: Snapshot
): BaselineRecordDbCreate[] => [
  ...snapshot.entities.map((entity, position) => ({
    workspace,
    baseline_id: baselineId,
    record_kind: 'entity' as const,
    record_id: entity.id,
    state: entity as unknown as Record<string, unknown>,
    schema: snapshot.entitySchemas.get(entity.schema_id) as unknown as Record<string, unknown> | null,
    state_hash: hashState(entityDiffState(entity)),
    position
  })),
  ...snapshot.relations.map((relation, position) => ({
    workspace,
    baseline_id: baselineId,
    record_kind: 'relation' as const,
    record_id: relation.id,
    state: relation as unknown as Record<string, unknown>,
    schema: snapshot.relationSchemas.get(relation.schema_id) as unknown as Record<string, unknown> | null,
    state_hash: hashState(relationDiffState(relation)),
    position
  }))
];

const managerRequired = (
  authCtx: AuthorizationContext,
  baseline: BaselineDbResult,
  userId: string
) => {
  if (checker.hasWorkspaceCapability(authCtx, 'ws.settings')) return;
  if (baseline.owner_team_id != null) {
    requireProjectAction(authCtx, baseline.owner_team_id, 'edit_project');
    return;
  }
  httpAssert.true(baseline.created_by === userId, {
    status: 403,
    message: 'Only the baseline creator or a workspace administrator can manage this baseline'
  });
};

const toLink = (link: BaselineLinkDbResult) => ({
  id: link.id,
  targetType: link.target_type,
  targetId: link.target_id,
  createdBy: link.created_by ? { id: link.created_by, name: link.created_by } : null,
  createdAt: link.created_at.toISOString()
});

const validateLinkTarget = async (
  db: DatabaseAdapter,
  workspace: string,
  authCtx: AuthorizationContext,
  targetType: BaselineLinkTargetType,
  targetId: string
) => {
  if (targetType === 'project') {
    const project = await db.project.getProject(workspace, targetId);
    httpAssert.present(project, { status: 404, message: 'Project not found' });
    requireProjectAccess(authCtx, project.owner);
    return;
  }
  if (targetType === 'milestone') {
    const milestone = await db.project.getMilestoneById(workspace, targetId);
    httpAssert.present(milestone, { status: 404, message: 'Milestone not found' });
    const project = await db.project.getProject(workspace, milestone.project_id);
    httpAssert.present(project, { status: 404, message: 'Milestone project not found' });
    requireProjectAccess(authCtx, project.owner);
    return;
  }
  if (targetType === 'planned_change') {
    const changeCase = await db.changeCase.getCase(workspace, targetId);
    httpAssert.present(changeCase, { status: 404, message: 'Planned change not found' });
    if (changeCase.project_id != null) {
      const project = await db.project.getProject(workspace, changeCase.project_id);
      httpAssert.present(project, { status: 404, message: 'Planned change project not found' });
      requireProjectAccess(authCtx, project.owner);
    }
    return;
  }
  if (targetType === 'document') {
    const document = await db.project.getAnyContentNodeById(workspace, targetId);
    httpAssert.present(document, { status: 404, message: 'Document not found' });
    if (document.project_id != null) {
      const project = await db.project.getProject(workspace, document.project_id);
      httpAssert.present(project, { status: 404, message: 'Document project not found' });
      requireProjectAccess(authCtx, project.owner);
    } else {
      requireWorkspaceCapability(authCtx, 'content.view');
    }
    return;
  }
  const governanceCase = await db.governance.getCase(workspace, targetId);
  httpAssert.present(governanceCase, { status: 404, message: 'Governance case not found' });
  requireWorkspaceView(authCtx);
};

const statusFor = async (
  db: DatabaseAdapter,
  workspace: string,
  authCtx: AuthorizationContext,
  baseline: BaselineDbResult
): Promise<Baseline['status']> => {
  if (baseline.superseded_by_id != null) return 'superseded';
  try {
    const captured = await storedSnapshot(db, workspace, baseline.id, authCtx);
    const current = await materialize(db, workspace, authCtx, {
      scope: baseline.scope,
      query: baseline.query,
      effectiveAt: new Date(),
      includePlannedChanges: baseline.include_planned_changes,
      includeOverdueChanges: baseline.include_overdue_changes
    });
    const capturedEntities = new Map(
      captured.entities.map(entity => [entity.id, hashState(entityDiffState(entity))])
    );
    const currentEntities = new Map(
      current.entities.map(entity => [entity.id, hashState(entityDiffState(entity))])
    );
    const capturedRelations = new Map(
      captured.relations.map(relation => [relation.id, hashState(relationDiffState(relation))])
    );
    const currentRelations = new Map(
      current.relations.map(relation => [relation.id, hashState(relationDiffState(relation))])
    );
    return capturedEntities.size === currentEntities.size &&
      [...capturedEntities].every(([id, hash]) => currentEntities.get(id) === hash) &&
      capturedRelations.size === currentRelations.size &&
      [...capturedRelations].every(([id, hash]) => currentRelations.get(id) === hash)
      ? 'active'
      : 'stale';
  } catch {
    return 'stale';
  }
};

const toSummary = async (
  db: DatabaseAdapter,
  workspace: string,
  authCtx: AuthorizationContext,
  baseline: BaselineDbResult
): Promise<Baseline> => ({
  id: baseline.id,
  workspaceId: baseline.workspace,
  name: baseline.name,
  description: baseline.description,
  ownerTeam: baseline.owner_team_id
    ? { id: baseline.owner_team_id, name: baseline.owner_team_id }
    : null,
  createdBy: baseline.created_by ? { id: baseline.created_by, name: baseline.created_by } : null,
  effectiveAt: baseline.effective_at.toISOString(),
  scope: { source: baseline.scope, query: baseline.query },
  includePlannedChanges: baseline.include_planned_changes,
  includeOverdueChanges: baseline.include_overdue_changes,
  status: await statusFor(db, workspace, authCtx, baseline),
  supersededById: baseline.superseded_by_id,
  deletedAt: baseline.deleted_at?.toISOString() ?? null,
  createdAt: baseline.created_at.toISOString(),
  entityCount: baseline.entity_count,
  relationCount: baseline.relation_count
});

const toDetail = async (
  db: DatabaseAdapter,
  workspace: string,
  authCtx: AuthorizationContext,
  baseline: BaselineDbResult,
  snapshot?: Snapshot
): Promise<BaselineDetail> => {
  const resolved = snapshot ?? (await storedSnapshot(db, workspace, baseline.id, authCtx));
  const summary = await toSummary(db, workspace, authCtx, baseline);
  const links = (await db.baseline.listBaselineLinks(workspace, baseline.id)).map(toLink);
  const entities: EntityRecord[] = resolved.entities.map(entity => {
    const schema = resolved.entitySchemas.get(entity.schema_id) ?? null;
    return toApiHistoricalEntity(
      entity,
      authCtx,
      schema,
      schema ? computeEntityCompleteness(entity, schema, authCtx) : entity.completeness
    );
  });
  const relations: RelationRecord[] = resolved.relations.map(relation =>
    toRedactedApiRelation(
      relation,
      authCtx,
      resolved.relationSchemas.get(relation.schema_id) ?? null
    )
  );
  return { ...summary, entities, relations, links };
};

const getBaseline = async (
  db: DatabaseAdapter,
  workspace: string,
  authCtx: AuthorizationContext,
  id: string,
  includeDeleted = false
) => {
  requireWorkspaceView(authCtx);
  const baseline = await db.baseline.getBaseline(workspace, id, includeDeleted);
  httpAssert.present(baseline, { status: 404, message: 'Baseline not found' });
  return baseline;
};

const snapshotDiff = (
  from: Snapshot,
  to: Snapshot,
  authCtx: AuthorizationContext
): EntityLandscapeDiff => {
  const fromEntities = new Map(from.entities.map(entity => [entity.id, entity]));
  const toEntities = new Map(to.entities.map(entity => [entity.id, entity]));
  const added = [...toEntities.values()]
    .filter(entity => !fromEntities.has(entity.id))
    .sort((left, right) => left.id.localeCompare(right.id))
    .map(entity =>
      toApiHistoricalEntity(entity, authCtx, to.entitySchemas.get(entity.schema_id) ?? null)
    );
  const removed = [...fromEntities.values()]
    .filter(entity => !toEntities.has(entity.id))
    .sort((left, right) => left.id.localeCompare(right.id))
    .map(entity =>
      toApiHistoricalEntity(entity, authCtx, from.entitySchemas.get(entity.schema_id) ?? null)
    );
  const changed = [...toEntities.values()]
    .filter(entity => fromEntities.has(entity.id))
    .map(entity => {
      const before = fromEntities.get(entity.id)!;
      return {
        entity,
        diff: buildDiff(entityDiffState(before), entityDiffState(entity)),
        beforeSchema: from.entitySchemas.get(before.schema_id) ?? null,
        afterSchema: to.entitySchemas.get(entity.schema_id) ?? null
      };
    })
    .filter(entry => Object.keys(entry.diff).length > 0)
    .sort((left, right) => left.entity.id.localeCompare(right.entity.id))
    .map(entry => ({
      entity: toApiHistoricalEntity(entry.entity, authCtx, entry.afterSchema),
      diff: redactKnownDataDiff(entry.diff, authCtx, entry.beforeSchema, entry.afterSchema)
    }));

  const fromRelations = new Map(from.relations.map(relation => [relation.id, relation]));
  const toRelations = new Map(to.relations.map(relation => [relation.id, relation]));
  const relationsAdded = [...toRelations.values()]
    .filter(relation => !fromRelations.has(relation.id))
    .sort((left, right) => left.id.localeCompare(right.id))
    .map(relation =>
      toRedactedApiRelation(
        relation,
        authCtx,
        to.relationSchemas.get(relation.schema_id) ?? null
      )
    );
  const relationsRemoved = [...fromRelations.values()]
    .filter(relation => !toRelations.has(relation.id))
    .sort((left, right) => left.id.localeCompare(right.id))
    .map(relation =>
      toRedactedApiRelation(
        relation,
        authCtx,
        from.relationSchemas.get(relation.schema_id) ?? null
      )
    );
  const relationsChanged = [...toRelations.values()]
    .filter(relation => fromRelations.has(relation.id))
    .map(relation => {
      const before = fromRelations.get(relation.id)!;
      return {
        relation,
        diff: buildDiff(relationDiffState(before), relationDiffState(relation)),
        beforeSchema: from.relationSchemas.get(before.schema_id) ?? null,
        afterSchema: to.relationSchemas.get(relation.schema_id) ?? null
      };
    })
    .filter(entry => Object.keys(entry.diff).length > 0)
    .sort((left, right) => left.relation.id.localeCompare(right.relation.id))
    .map(entry => ({
      relation: toRedactedApiRelation(entry.relation, authCtx, entry.afterSchema),
      diff: redactKnownDataDiff(
        entry.diff,
        authCtx,
        entry.beforeSchema,
        entry.afterSchema
      )
    }));

  return {
    added,
    removed,
    changed,
    relations: { added: relationsAdded, removed: relationsRemoved, changed: relationsChanged }
  };
};

export const listBaselines = async (
  db: DatabaseAdapter,
  workspace: string,
  authCtx: AuthorizationContext,
  includeDeleted = false
) => {
  if (includeDeleted) requireWorkspaceCapability(authCtx, 'ws.settings');
  else requireWorkspaceView(authCtx);
  const baselines = await db.baseline.listBaselines(workspace, includeDeleted);
  return Promise.all(baselines.map(baseline => toSummary(db, workspace, authCtx, baseline)));
};

export const createBaseline = async (
  db: DatabaseAdapter,
  workspace: string,
  authCtx: AuthorizationContext,
  input: CreateBaselineRequest,
  createdBy: string
) => {
  const project = await ensureScopeAccess(db, workspace, input.scope, authCtx);
  if (input.ownerTeamId != null) requireProjectAction(authCtx, input.ownerTeamId, 'edit_project');
  const ownerTeamId = input.ownerTeamId ?? project?.owner ?? null;
  if (ownerTeamId != null && input.ownerTeamId == null && project == null) {
    requireProjectAction(authCtx, ownerTeamId, 'edit_project');
  }
  const effectiveAt = new Date(input.effectiveAt);
  const query =
    input.scope.kind === 'saved_view'
      ? {
          ...(await resolveSavedViewQuery(db, workspace, input.scope))!,
          asOf: effectiveAt.toISOString(),
          includePlannedChanges: input.includePlannedChanges
        }
      : null;
  const snapshot = await materialize(db, workspace, authCtx, {
    scope: input.scope,
    query,
    effectiveAt,
    includePlannedChanges: input.includePlannedChanges,
    includeOverdueChanges: input.includeOverdueChanges
  });
  const id = randomUUID();
  const baseline = await db.core.transaction(async tx => {
    const created = await tx.baseline.createBaseline({
      id,
      workspace,
      name: input.name,
      description: input.description ?? null,
      owner_team_id: ownerTeamId,
      created_by: createdBy,
      effective_at: effectiveAt,
      scope: input.scope,
      query,
      include_planned_changes: input.includePlannedChanges,
      include_overdue_changes: input.includeOverdueChanges,
      created_at: new Date(),
      entity_count: snapshot.entities.length,
      relation_count: snapshot.relations.length
    });
    await tx.baseline.insertBaselineRecords(makeRecordInputs(workspace, id, snapshot));
    return created;
  });
  return toSummary(db, workspace, authCtx, baseline);
};

export const getBaselineDetail = async (
  db: DatabaseAdapter,
  workspace: string,
  authCtx: AuthorizationContext,
  id: string
) => {
  const baseline = await getBaseline(db, workspace, authCtx, id);
  return toDetail(db, workspace, authCtx, baseline);
};

export const compareBaselines = async (
  db: DatabaseAdapter,
  workspace: string,
  authCtx: AuthorizationContext,
  fromRef: { kind: 'baseline' | 'current'; id?: string },
  toRef: { kind: 'baseline' | 'current'; id?: string }
) => {
  httpAssert.true(fromRef.kind === 'baseline' || toRef.kind === 'baseline', {
    status: 400,
    message: 'At least one comparison side must be a baseline'
  });
  const loadBaseline = async (id: string) => getBaseline(db, workspace, authCtx, id);
  const fromBaseline = fromRef.kind === 'baseline' ? await loadBaseline(fromRef.id!) : null;
  const toBaseline = toRef.kind === 'baseline' ? await loadBaseline(toRef.id!) : null;
  const currentSource = fromBaseline ?? toBaseline!;
  const loadSnapshot = async (
    ref: { kind: 'baseline' | 'current'; id?: string },
    baseline: BaselineDbResult | null
  ) => {
    if (ref.kind === 'baseline') return storedSnapshot(db, workspace, baseline!.id, authCtx);
    return materialize(db, workspace, authCtx, {
      scope: currentSource.scope,
      query: currentSource.query,
      effectiveAt: new Date(),
      includePlannedChanges: currentSource.include_planned_changes,
      includeOverdueChanges: currentSource.include_overdue_changes
    });
  };
  const [from, to] = await Promise.all([
    loadSnapshot(fromRef, fromBaseline),
    loadSnapshot(toRef, toBaseline)
  ]);
  return snapshotDiff(from, to, authCtx);
};

const ensureNoSupersedeCycle = async (
  db: DatabaseAdapter,
  workspace: string,
  baselineId: string,
  replacementId: string
) => {
  const visited = new Set<string>([baselineId]);
  let currentId: string | null = replacementId;
  while (currentId != null) {
    httpAssert.true(!visited.has(currentId), {
      status: 409,
      message: 'Superseding this baseline would create a cycle'
    });
    visited.add(currentId);
    const current = await db.baseline.getBaseline(workspace, currentId, true);
    currentId = current?.superseded_by_id ?? null;
  }
};

export const supersedeBaseline = async (
  db: DatabaseAdapter,
  workspace: string,
  authCtx: AuthorizationContext,
  id: string,
  replacementId: string,
  userId: string
) => {
  httpAssert.true(id !== replacementId, { status: 400, message: 'A baseline cannot supersede itself' });
  const baseline = await getBaseline(db, workspace, authCtx, id);
  const replacement = await getBaseline(db, workspace, authCtx, replacementId);
  managerRequired(authCtx, baseline, userId);
  managerRequired(authCtx, replacement, userId);
  await ensureNoSupersedeCycle(db, workspace, id, replacementId);
  const updated = await db.baseline.setSupersededBy(workspace, id, replacementId);
  httpAssert.present(updated, { status: 409, message: 'Baseline changed while superseding' });
  return toSummary(db, workspace, authCtx, updated);
};

export const deleteBaseline = async (
  db: DatabaseAdapter,
  workspace: string,
  authCtx: AuthorizationContext,
  id: string,
  userId: string
) => {
  const baseline = await getBaseline(db, workspace, authCtx, id);
  managerRequired(authCtx, baseline, userId);
  const deleted = await db.baseline.softDelete(workspace, id, userId, new Date());
  httpAssert.present(deleted, { status: 409, message: 'Baseline changed while deleting' });
  return toSummary(db, workspace, authCtx, deleted);
};

export const exportBaseline = async (
  db: DatabaseAdapter,
  workspace: string,
  authCtx: AuthorizationContext,
  id: string
) => getBaselineDetail(db, workspace, authCtx, id);

export const listBaselineLinks = async (
  db: DatabaseAdapter,
  workspace: string,
  authCtx: AuthorizationContext,
  baselineId: string
) => {
  await getBaseline(db, workspace, authCtx, baselineId);
  return (await db.baseline.listBaselineLinks(workspace, baselineId)).map(toLink);
};

export const createBaselineLink = async (
  db: DatabaseAdapter,
  workspace: string,
  authCtx: AuthorizationContext,
  baselineId: string,
  targetType: BaselineLinkTargetType,
  targetId: string,
  userId: string
) => {
  const baseline = await getBaseline(db, workspace, authCtx, baselineId);
  managerRequired(authCtx, baseline, userId);
  await validateLinkTarget(db, workspace, authCtx, targetType, targetId);
  const existing = (await db.baseline.listBaselineLinks(workspace, baselineId)).find(
    link => link.target_type === targetType && link.target_id === targetId
  );
  httpAssert.true(existing == null, { status: 409, message: 'Baseline reference already exists' });
  const link = await db.baseline.createBaselineLink({
    workspace,
    baseline_id: baselineId,
    target_type: targetType,
    target_id: targetId,
    created_by: userId,
    created_at: new Date()
  });
  return toLink(link);
};

export const deleteBaselineLink = async (
  db: DatabaseAdapter,
  workspace: string,
  authCtx: AuthorizationContext,
  baselineId: string,
  linkId: string,
  userId: string
) => {
  const baseline = await getBaseline(db, workspace, authCtx, baselineId);
  managerRequired(authCtx, baseline, userId);
  const link = await db.baseline.deleteBaselineLink(workspace, baselineId, linkId);
  httpAssert.present(link, { status: 404, message: 'Baseline reference not found' });
  return toLink(link);
};
