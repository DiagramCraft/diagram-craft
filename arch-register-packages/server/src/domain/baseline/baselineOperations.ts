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
import type {
  EntityDbResult,
  EntityVersionDbResult,
  SchemaDbResult,
  SchemaVersionDbResult
} from '../catalog/db/catalogDatabase';
import type {
  RelationDbResult,
  RelationSchemaDbResult,
  RelationSchemaVersionDbResult
} from '../catalog/db/relationDatabase';
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
  createHash('sha256')
    .update(JSON.stringify(canonicalize(state)))
    .digest('hex');

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

const applyEntitySchemaVersion = (
  schema: SchemaDbResult | null,
  version: SchemaVersionDbResult | null
): SchemaDbResult | null => {
  if (schema == null || version == null) return schema;
  return {
    ...schema,
    name: version.name,
    description: version.description,
    fields: version.fields as SchemaDbResult['fields'],
    templates: version.templates,
    groups: version.groups as SchemaDbResult['groups'],
    shared_field_group_links: version.shared_field_group_links,
    validation_rules: version.validation_rules,
    color: version.color,
    icon: version.icon,
    version: version.version
  };
};

const applyRelationSchemaVersion = (
  schema: RelationSchemaDbResult | null,
  version: RelationSchemaVersionDbResult | null
): RelationSchemaDbResult | null => {
  if (schema == null || version == null) return schema;
  return {
    ...schema,
    name: version.name,
    description: version.description,
    in_schema_ids: version.in_schema_ids,
    out_schema_ids: version.out_schema_ids,
    fields: version.fields,
    groups: version.groups,
    validation_rules: version.validation_rules,
    color: version.color,
    icon: version.icon,
    version: version.version
  };
};

const latestVersionsByRecord = (versions: EntityVersionDbResult[]) => {
  const result = new Map<string, EntityVersionDbResult>();
  for (const version of versions) result.set(version.record_id, version);
  return result;
};

const listSnapshotVersions = async (
  db: DatabaseAdapter,
  workspace: string,
  effectiveAt: Date,
  snapshot: Snapshot
) => {
  const [entityVersions, relationVersions] = await Promise.all([
    db.catalog.listEntityVersionsAsOf(
      workspace,
      effectiveAt,
      snapshot.entities.map(entity => entity.id)
    ),
    db.catalog.listRelationVersionsAsOf(
      workspace,
      effectiveAt,
      snapshot.relations.map(relation => relation.id)
    )
  ]);
  return new Map([
    ...latestVersionsByRecord(entityVersions),
    ...latestVersionsByRecord(relationVersions)
  ]);
};

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
        ? await resolveProjectCandidates(
            db,
            workspace,
            spec.scope.projectId,
            spec.scope.projectScope
          )
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
    if (!entityIds.has(relation.in_entity_id) || !entityIds.has(relation.out_entity_id))
      return false;
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
  const versions = await db.catalog.listEntityVersionsByVersionIds(
    workspace,
    records.map(record => record.record_version_id).filter((id): id is string => id != null)
  );
  const versionById = new Map(versions.map(version => [version.id, version]));
  const entityEntries = records
    .filter(record => record.record_kind === 'entity')
    .map(record => {
      const version = record.record_version_id
        ? versionById.get(record.record_version_id)
        : undefined;
      const state = record.state ?? version?.state;
      if (state == null) {
        throw new Error(`Baseline record '${record.record_id}' has no captured state`);
      }
      return { record, version, entity: deserializeEntity(state) };
    });
  const relationEntries = records
    .filter(record => record.record_kind === 'relation')
    .map(record => {
      const version = record.record_version_id
        ? versionById.get(record.record_version_id)
        : undefined;
      const state = record.state ?? version?.state;
      if (state == null) {
        throw new Error(`Baseline record '${record.record_id}' has no captured state`);
      }
      return { record, version, relation: deserializeRelation(state) };
    });

  const entitySchemaIds = [...new Set(entityEntries.map(entry => entry.entity.schema_id))];
  const entitySchemasById = new Map(
    (await db.catalog.listSchemas(workspace)).map(schema => [schema.id, schema])
  );
  const entitySchemaVersionsById = new Map(
    (
      await Promise.all(
        entitySchemaIds.map(async schemaId => db.catalog.listSchemaVersions(workspace, schemaId))
      )
    )
      .flat()
      .map(version => [version.id, version])
  );
  const entitySchemas = new Map<string, SchemaDbResult | null>();
  for (const entry of entityEntries) {
    if (entitySchemas.has(entry.entity.schema_id)) continue;
    entitySchemas.set(
      entry.entity.schema_id,
      applyEntitySchemaVersion(
        entitySchemasById.get(entry.entity.schema_id) ?? null,
        entry.version?.schema_version_id
          ? (entitySchemaVersionsById.get(entry.version.schema_version_id) ?? null)
          : null
      )
    );
  }

  const allEntities = entityEntries.map(entry => entry.entity);
  const [owners, lifecycleStates] = await Promise.all([
    db.workspace.listTeams(workspace),
    db.workspace.listLifecycleStates(workspace)
  ]);
  const ownerNameById = new Map(owners.map(owner => [owner.id, owner.name]));
  const lifecycleLabelById = new Map(lifecycleStates.map(state => [state.id, state.label]));
  const entities = filterVisibleEntities(authCtx, allEntities).map(entity => ({
    ...entity,
    owner_name: entity.owner ? (ownerNameById.get(entity.owner) ?? entity.owner_name) : null,
    lifecycle_label: entity.lifecycle
      ? (lifecycleLabelById.get(entity.lifecycle) ?? entity.lifecycle_label)
      : null,
    target_lifecycle_label: entity.target_lifecycle
      ? (lifecycleLabelById.get(entity.target_lifecycle) ?? entity.target_lifecycle_label)
      : null,
    schema_name: entitySchemas.get(entity.schema_id)?.name ?? entity.schema_name
  }));
  const entityIds = new Set(entities.map(entity => entity.id));

  const relationSchemaIds = [...new Set(relationEntries.map(entry => entry.relation.schema_id))];
  const relationSchemasById = new Map(
    (await db.relation.listRelationSchemas(workspace)).map(schema => [schema.id, schema])
  );
  const relationSchemaVersionsById = new Map(
    (
      await Promise.all(
        relationSchemaIds.map(async schemaId =>
          db.relation.listRelationSchemaVersions(workspace, schemaId)
        )
      )
    )
      .flat()
      .map(version => [version.id, version])
  );
  const relationSchemas = new Map<string, RelationSchemaDbResult | null>();
  for (const entry of relationEntries) {
    if (relationSchemas.has(entry.relation.schema_id)) continue;
    relationSchemas.set(
      entry.relation.schema_id,
      applyRelationSchemaVersion(
        relationSchemasById.get(entry.relation.schema_id) ?? null,
        entry.version?.schema_version_id
          ? (relationSchemaVersionsById.get(entry.version.schema_version_id) ?? null)
          : null
      )
    );
  }
  const entityById = new Map(entities.map(entity => [entity.id, entity]));
  const relations = relationEntries
    .map(entry => {
      const relation = entry.relation;
      const inEntity = entityById.get(relation.in_entity_id);
      const outEntity = entityById.get(relation.out_entity_id);
      const relationSchema = relationSchemas.get(relation.schema_id);
      return {
        ...relation,
        schema_name: relationSchema?.name ?? relation.schema_name,
        in_entity_name: inEntity?.name ?? relation.in_entity_name,
        in_entity_schema_id: inEntity?.schema_id ?? relation.in_entity_schema_id,
        out_entity_name: outEntity?.name ?? relation.out_entity_name,
        out_entity_schema_id: outEntity?.schema_id ?? relation.out_entity_schema_id,
        owner_name: relation.owner
          ? (ownerNameById.get(relation.owner) ?? relation.owner_name)
          : null,
        lifecycle_label: relation.lifecycle
          ? (lifecycleLabelById.get(relation.lifecycle) ?? relation.lifecycle_label)
          : null
      };
    })
    .filter(relation => {
      if (!entityIds.has(relation.in_entity_id) || !entityIds.has(relation.out_entity_id))
        return false;
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

  return { entities, relations, entitySchemas, relationSchemas };
};

const makeRecordInputs = (
  workspace: string,
  baselineId: string,
  snapshot: Snapshot,
  versions: Map<string, EntityVersionDbResult>
): BaselineRecordDbCreate[] => [
  ...snapshot.entities.map((entity, position) => ({
    workspace,
    baseline_id: baselineId,
    record_kind: 'entity' as const,
    record_id: entity.id,
    record_version_id: versions.get(entity.id)?.id ?? null,
    state:
      versions.get(entity.id) == null ||
      hashState(entityDiffState(entity)) !==
        hashState(entityDiffState(deserializeEntity(versions.get(entity.id)!.state)))
        ? (entity as unknown as Record<string, unknown>)
        : null,
    state_hash: hashState(entityDiffState(entity)),
    position
  })),
  ...snapshot.relations.map((relation, position) => ({
    workspace,
    baseline_id: baselineId,
    record_kind: 'relation' as const,
    record_id: relation.id,
    record_version_id: versions.get(relation.id)?.id ?? null,
    state:
      versions.get(relation.id) == null ||
      hashState(relationDiffState(relation)) !==
        hashState(relationDiffState(deserializeRelation(versions.get(relation.id)!.state)))
        ? (relation as unknown as Record<string, unknown>)
        : null,
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
      toRedactedApiRelation(relation, authCtx, to.relationSchemas.get(relation.schema_id) ?? null)
    );
  const relationsRemoved = [...fromRelations.values()]
    .filter(relation => !toRelations.has(relation.id))
    .sort((left, right) => left.id.localeCompare(right.id))
    .map(relation =>
      toRedactedApiRelation(relation, authCtx, from.relationSchemas.get(relation.schema_id) ?? null)
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
      diff: redactKnownDataDiff(entry.diff, authCtx, entry.beforeSchema, entry.afterSchema)
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
    input.query != null
      ? {
          ...input.query,
          asOf: effectiveAt.toISOString(),
          includePlannedChanges: input.includePlannedChanges
        }
      : input.scope.kind === 'saved_view'
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
  const snapshotVersions = await listSnapshotVersions(db, workspace, effectiveAt, snapshot);
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
    await tx.baseline.insertBaselineRecords(
      makeRecordInputs(workspace, id, snapshot, snapshotVersions)
    );
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
  httpAssert.true(id !== replacementId, {
    status: 400,
    message: 'A baseline cannot supersede itself'
  });
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
