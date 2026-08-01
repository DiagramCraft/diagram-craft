import type { AuthorizationContext } from '@arch-register/permissions';
import type {
  EntityLandscapeDiff,
  EntityLandscapeDiffState,
  EntityRecord
} from '@arch-register/api-types/entityContract';
import type { DatabaseAdapter } from '../../db/database';
import { requireProjectAccess, filterVisibleEntities } from '../auth/authorization';
import { httpAssert } from '../../utils/httpAssert';
import { listAllCatalogEntities } from './entityLoader';
import { reconstructEntitiesAsOf } from './entitySnapshotReconstruction';
import { buildDiff, redactDataDiff } from './entityDiff';
import { toApiEntity } from './entityHelpers';
import { filterRestrictedFieldGroups } from '../auth/fieldGroupAccessControl';
import { filterEntities, matchesFilterCondition } from './dataHelpers';
import { resolveJoinedAssessment } from './entityQueryOperations';
import {
  splitAssessmentConditions,
  matchesAssessmentConditions
} from '@arch-register/api-types/assessmentFilter';
import type { EntityDbResult, SchemaDbResult } from './db/catalogDatabase';

const entityState = (entity: EntityDbResult): Record<string, unknown> => ({
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

type ProjectScope = {
  projectId: string;
  projectScope: 'project' | 'all';
  candidateEntityIds?: string[];
  links: Awaited<ReturnType<DatabaseAdapter['project']['listProjectEntityLinks']>>;
};

const resolveProjectScope = async (
  db: DatabaseAdapter,
  workspace: string,
  authCtx: AuthorizationContext,
  projectId: string | undefined,
  projectScope: 'project' | 'all'
): Promise<ProjectScope | null> => {
  if (!projectId) return null;

  const project = await db.project.getProject(workspace, projectId);
  httpAssert.present(project, {
    status: 404,
    message: `Project '${projectId}' not found`
  });
  requireProjectAccess(authCtx, project.owner);

  const [scopedEntities, links] = await Promise.all([
    listAllCatalogEntities(db, workspace, { projectId, projectScope: 'project' }),
    db.project.listProjectEntityLinks(workspace, projectId)
  ]);
  const candidateEntityIds = [
    ...new Set([...scopedEntities.map(entity => entity.id), ...links.map(link => link.entity_id)])
  ];
  return { projectId, projectScope, candidateEntityIds, links };
};

const parseStateDate = (state: EntityLandscapeDiffState): Date => new Date(state.asOf);

// Applies the same filtering rules the entity browser uses for its live/point-in-time entity
// list (schema/owner/lifecycle/q via `filterEntities`, conditions, joined-assessment conditions,
// and collection membership), evaluated against one side's reconstructed entity list. Run
// independently per side since matching values (lifecycle, owner, assessment responses, etc.) can
// differ between "now" and the target date.
const applyStateFilters = async (
  db: DatabaseAdapter,
  workspace: string,
  authCtx: AuthorizationContext,
  state: EntityLandscapeDiffState,
  entities: EntityDbResult[]
): Promise<EntityDbResult[]> => {
  const conditions = state.conditions ?? [];
  const { assessmentConditions, otherConditions } = splitAssessmentConditions(conditions);

  const [joinedAssessment, collectionEntityIds] = await Promise.all([
    resolveJoinedAssessment(
      db,
      workspace,
      authCtx,
      state.assessmentId ?? null,
      assessmentConditions.length > 0
    ),
    state.collectionId
      ? db.view.listCollectionEntityIds(authCtx.userId, workspace, state.collectionId)
      : Promise.resolve(null)
  ]);
  const collectionEntityIdSet = collectionEntityIds == null ? null : new Set(collectionEntityIds);

  const byBasicFilters = filterEntities(entities, {
    schemaId: null,
    owner: null,
    lifecycle: null,
    q: state.q ?? ''
  });

  return byBasicFilters.filter(entity => {
    if (collectionEntityIdSet && !collectionEntityIdSet.has(entity.id)) return false;
    if (
      otherConditions.length > 0 &&
      !otherConditions.every(c => matchesFilterCondition(entity, c, entity.completeness))
    )
      return false;
    if (
      joinedAssessment &&
      !matchesAssessmentConditions(
        joinedAssessment.responsesByEntity.get(entity.id),
        assessmentConditions,
        joinedAssessment.assessment.fields
      )
    )
      return false;
    return true;
  });
};

const reconstructState = async (
  db: DatabaseAdapter,
  workspace: string,
  authCtx: AuthorizationContext,
  state: EntityLandscapeDiffState,
  projectScope: ProjectScope | null,
  now: Date
): Promise<EntityDbResult[]> => {
  const reconstructed = await reconstructEntitiesAsOf(
    db,
    workspace,
    parseStateDate(state),
    authCtx,
    projectScope?.candidateEntityIds,
    state.includePlannedChanges,
    projectScope?.projectId,
    state.includeOverdueChanges ? undefined : now
  );

  const linkIds = projectScope
    ? new Set(
        projectScope.links
          .filter(link => link.created_at <= parseStateDate(state))
          .map(link => link.entity_id)
      )
    : null;

  const scoped = reconstructed.filter(entity => {
    if (projectScope == null) return true;
    if (projectScope.projectScope === 'project') {
      return entity.project_id === projectScope.projectId || linkIds?.has(entity.id) === true;
    }
    return entity.project_id == null || entity.project_id === projectScope.projectId;
  });
  const visible = filterVisibleEntities(authCtx, scoped);
  return applyStateFilters(db, workspace, authCtx, state, visible);
};

const toApi = (
  entity: EntityDbResult,
  authCtx: AuthorizationContext,
  schemaById: Map<string, SchemaDbResult>
): EntityRecord =>
  toApiEntity(entity, authCtx, schemaById.get(entity.schema_id) ?? null, entity.completeness);

export const diffEntityLandscapes = async (
  db: DatabaseAdapter,
  workspace: string,
  authCtx: AuthorizationContext,
  from: EntityLandscapeDiffState,
  to: EntityLandscapeDiffState
): Promise<EntityLandscapeDiff> => {
  const projectIds = [from.projectId, to.projectId].filter(
    (projectId): projectId is string => projectId != null
  );
  const isScenarioComparison = new Set(projectIds).size > 1;
  if (isScenarioComparison) {
    httpAssert.true(from.projectScope === 'all' && to.projectScope === 'all', {
      status: 400,
      message: 'Comparing different projects requires workspace-wide scenario scope'
    });
  }

  const [fromScope, toScope] = isScenarioComparison
    ? await Promise.all([
        resolveProjectScope(db, workspace, authCtx, from.projectId, 'all'),
        resolveProjectScope(db, workspace, authCtx, to.projectId, 'all')
      ])
    : [
        await resolveProjectScope(
          db,
          workspace,
          authCtx,
          projectIds[0],
          to.projectScope ?? from.projectScope ?? 'project'
        ),
        null
      ];

  // Scenario comparisons intentionally reconstruct the complete workspace. The per-side
  // project filter below keeps project-owned entities on their owning side while shared/global
  // entities remain present on both sides as the live fallback when only one project changes them.
  const scopes = isScenarioComparison
    ? [
        fromScope ? { ...fromScope, candidateEntityIds: undefined } : null,
        toScope ? { ...toScope, candidateEntityIds: undefined } : null
      ]
    : [fromScope, fromScope];
  const now = new Date();
  const [fromEntities, toEntities, currentEntities] = await Promise.all([
    reconstructState(db, workspace, authCtx, from, scopes[0] ?? null, now),
    reconstructState(db, workspace, authCtx, to, scopes[1] ?? null, now),
    isScenarioComparison
      ? reconstructState(
          db,
          workspace,
          authCtx,
          {
            asOf: now.toISOString(),
            includePlannedChanges: false,
            includeOverdueChanges: false
          },
          null,
          now
        )
      : Promise.resolve([])
  ]);
  const fromById = new Map(fromEntities.map(entity => [entity.id, entity]));
  const toById = new Map(toEntities.map(entity => [entity.id, entity]));
  const currentById = new Map(currentEntities.map(entity => [entity.id, entity]));

  const schemas = await db.catalog.listSchemas(workspace);
  const schemaById = new Map(schemas.map(schema => [schema.id, schema]));
  const schemaFor = (entity: EntityDbResult) => schemaById.get(entity.schema_id) ?? null;

  const added = [...toById.values()]
    .filter(entity => !fromById.has(entity.id))
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(entity => toApi(entity, authCtx, schemaById));
  const removed = [...fromById.values()]
    .filter(entity => !toById.has(entity.id))
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(entity => toApi(entity, authCtx, schemaById));
  const changed = [...toById.values()]
    .filter(entity => fromById.has(entity.id))
    .map(entity => ({
      entity,
      // Raw (unredacted) diff decides whether the entity belongs in `changed` at all — an entity
      // whose only change is in a restricted group must still be included, surfaced below as an
      // empty `diff: {}` ("Restricted changes"), rather than disappearing silently.
      diff: buildDiff(entityState(fromById.get(entity.id)!), entityState(entity)),
      current: currentById.get(entity.id)
    }))
    .filter(entry => Object.keys(entry.diff).length > 0)
    .sort((a, b) => a.entity.id.localeCompare(b.entity.id))
    .map(entry => {
      const fromEntity = fromById.get(entry.entity.id)!;
      const redactedDiff = redactDataDiff(
        entry.diff,
        authCtx,
        schemaFor(fromEntity),
        schemaFor(entry.entity)
      );
      const currentEntity = entry.current ?? entry.entity;
      const diff = isScenarioComparison
        ? Object.fromEntries(
            Object.entries(redactedDiff).map(([key, fieldDiff]) => {
              if (key !== 'data') {
                return [key, { ...fieldDiff, current: entityState(currentEntity)[key] ?? null }];
              }
              const current = filterRestrictedFieldGroups(
                authCtx,
                schemaFor(currentEntity),
                (entityState(currentEntity)[key] ?? {}) as Record<string, unknown>
              );
              return [key, { ...fieldDiff, current }];
            })
          )
        : redactedDiff;
      return { entity: toApi(entry.entity, authCtx, schemaById), diff };
    });

  return { added, removed, changed };
};
