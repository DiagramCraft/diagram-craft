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
import { buildDiff, redactKnownDataDiff } from './entityDiff';
import { toApiEntity, toApiHistoricalEntity } from './entityHelpers';
import { computeEntityCompleteness } from '../../utils/completeness';
import { filterKnownRestrictedFieldGroups } from '../auth/fieldGroupAccessControl';
import { filterEntities, matchesFilterCondition } from './dataHelpers';
import { resolveJoinedAssessment } from './entityQueryOperations';
import { filterConditionsToEntityQueryIR } from './entityQueryIRMapping';
import {
  resolveFieldSchemaScope,
  validateEntityQueryIR,
  type SchemaCatalog
} from './entityQueryIRValidator';
import {
  splitAssessmentConditions,
  matchesAssessmentConditions
} from '@arch-register/api-types/assessmentFilter';
import type { EntityDbResult } from './db/catalogDatabase';
import type { RelationDbResult } from './db/relationDatabase';
import {
  availableSchemaCatalog,
  resolveEntitySchemaCatalogAt,
  resolveRelationSchemaCatalogAt,
  type HistoricalSchemaCatalog,
  type HistoricalRelationSchemaCatalog
} from './schemaHistory';
import { reconstructRelationsAsOf } from './relationSnapshotReconstruction';
import { getRelationOwnerSchemas, toRedactedApiRelation } from './relationHelpers';
import { canViewTypedRelation } from './relationAccessControl';
import type { RelationRecord } from '@arch-register/api-types/relationContract';

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

// Only the two mutable fields matter for a relation (see assertRelationProposalEndpointsUnchanged
// — endpoints are immutable) — buildDiff's fixed mutableStateKeys list still works unmodified
// here since every other key is simply absent from both sides and compares equal.
const relationState = (relation: RelationDbResult): Record<string, unknown> => ({
  schema_id: relation.schema_id,
  data: relation.data
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

const validateStateConditions = (
  state: EntityLandscapeDiffState,
  schemas: SchemaCatalog,
  authCtx: AuthorizationContext
) => {
  const query = filterConditionsToEntityQueryIR(
    null,
    state.assessmentId ?? null,
    state.conditions ?? []
  );
  const validation = validateEntityQueryIR(query, schemas, authCtx);
  httpAssert.true(validation.ok, {
    status: 400,
    message: validation.ok
      ? undefined
      : validation.errors.map(error => `${error.path.join('.')}: ${error.message}`).join('; ')
  });
};

const matchesVisibleFilterCondition = (
  entity: EntityDbResult,
  condition: Parameters<typeof matchesFilterCondition>[1],
  completeness: number | null,
  schemas: SchemaCatalog,
  authCtx: AuthorizationContext
): boolean => {
  const fieldScope = resolveFieldSchemaScope(condition.fieldId, schemas, authCtx);
  if (fieldScope.needsScoping && !fieldScope.grantedSchemaIds.has(entity.schema_id)) {
    return false;
  }
  return matchesFilterCondition(entity, condition, completeness);
};

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
  entities: EntityDbResult[],
  schemas: SchemaCatalog
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
      !otherConditions.every(c =>
        matchesVisibleFilterCondition(entity, c, entity.completeness, schemas, authCtx)
      )
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
  now: Date,
  schemas: SchemaCatalog
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
  return applyStateFilters(db, workspace, authCtx, state, visible, schemas);
};

/**
 * Relation counterpart of reconstructState. Simpler on two axes: relations aren't project-scoped
 * (only their planned changes are, via the owning change case's project_id — see
 * reconstructRelationsAsOf/resolveFutureUpdatesByRecord), so there's no candidate-id/link
 * filtering to do here; and there's no query-condition/search filtering support for relations yet
 * (out of scope — the landscape-diff state has no relation-side filter fields), so every visible
 * reconstructed relation is included. Endpoint visibility is evaluated against the schema
 * catalog resolved for this state's timestamp, rather than the live catalog.
 */
const reconstructRelationState = async (
  db: DatabaseAdapter,
  workspace: string,
  authCtx: AuthorizationContext,
  state: EntityLandscapeDiffState,
  projectId: string | undefined,
  now: Date,
  endpointSchemas: HistoricalSchemaCatalog
): Promise<RelationDbResult[]> => {
  const reconstructed = await reconstructRelationsAsOf(
    db,
    workspace,
    parseStateDate(state),
    authCtx,
    undefined,
    state.includePlannedChanges,
    projectId,
    state.includeOverdueChanges ? undefined : now
  );

  const visibility = await Promise.all(
    reconstructed.map(async relation => {
      const { inSchema, outSchema } = await getRelationOwnerSchemas(
        db,
        workspace,
        relation,
        endpointSchemas
      );
      return canViewTypedRelation(
        authCtx,
        [
          { schema: inSchema, direction: 'in' },
          { schema: outSchema, direction: 'out' }
        ],
        relation.schema_id
      );
    })
  );
  return reconstructed.filter((_, index) => visibility[index]);
};

const toApi = (
  entity: EntityDbResult,
  authCtx: AuthorizationContext,
  schemaById: HistoricalSchemaCatalog,
  historical: boolean
): EntityRecord => {
  const schema = schemaById.get(entity.schema_id) ?? null;
  const visibleCompleteness = schema
    ? computeEntityCompleteness(entity, schema, authCtx)
    : entity.completeness;
  return historical
    ? toApiHistoricalEntity(entity, authCtx, schema, visibleCompleteness)
    : toApiEntity(entity, authCtx, schema, visibleCompleteness);
};

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

  const schemas = await db.catalog.listSchemas(workspace);
  const [fromSchemas, toSchemas] = await Promise.all([
    resolveEntitySchemaCatalogAt(db, workspace, schemas, parseStateDate(from)),
    resolveEntitySchemaCatalogAt(db, workspace, schemas, parseStateDate(to))
  ]);
  const fromSchemaCatalog = availableSchemaCatalog(fromSchemas);
  const toSchemaCatalog = availableSchemaCatalog(toSchemas);
  validateStateConditions(from, fromSchemaCatalog, authCtx);
  validateStateConditions(to, toSchemaCatalog, authCtx);

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
  const currentSchemas: HistoricalSchemaCatalog = new Map(
    schemas.map(schema => [schema.id, schema] as const)
  );
  const [fromEntities, toEntities, currentEntities] = await Promise.all([
    reconstructState(db, workspace, authCtx, from, scopes[0] ?? null, now, fromSchemaCatalog),
    reconstructState(db, workspace, authCtx, to, scopes[1] ?? null, now, toSchemaCatalog),
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
          now,
          availableSchemaCatalog(currentSchemas)
        )
      : Promise.resolve([])
  ]);
  const fromById = new Map(fromEntities.map(entity => [entity.id, entity]));
  const toById = new Map(toEntities.map(entity => [entity.id, entity]));
  const currentById = new Map(currentEntities.map(entity => [entity.id, entity]));

  const schemaFor = (entity: EntityDbResult, catalog: HistoricalSchemaCatalog) =>
    catalog.get(entity.schema_id) ?? null;

  const added = [...toById.values()]
    .filter(entity => !fromById.has(entity.id))
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(entity => toApi(entity, authCtx, toSchemas, true));
  const removed = [...fromById.values()]
    .filter(entity => !toById.has(entity.id))
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(entity => toApi(entity, authCtx, fromSchemas, true));
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
      const redactedDiff = redactKnownDataDiff(
        entry.diff,
        authCtx,
        schemaFor(fromEntity, fromSchemas),
        schemaFor(entry.entity, toSchemas)
      );
      const currentEntity = entry.current ?? entry.entity;
      const diff = isScenarioComparison
        ? Object.fromEntries(
            Object.entries(redactedDiff).map(([key, fieldDiff]) => {
              if (key !== 'data') {
                return [key, { ...fieldDiff, current: entityState(currentEntity)[key] ?? null }];
              }
              const current = filterKnownRestrictedFieldGroups(
                authCtx,
                schemaFor(currentEntity, currentSchemas),
                (entityState(currentEntity)[key] ?? {}) as Record<string, unknown>
              );
              return [key, { ...fieldDiff, current }];
            })
          )
        : redactedDiff;
      return { entity: toApi(entry.entity, authCtx, toSchemas, true), diff };
    });

  // Relations aren't project-scoped themselves (only their planned changes are), so the
  // "current" scenario-comparison enrichment entities get above isn't attempted here — that's a
  // deliberately narrower relation feature set than entities have, not an omission: relations
  // only diff added/removed/changed between the two states directly.
  const relationSchemas = await db.relation.listRelationSchemas(workspace);
  const [fromRelationSchemas, toRelationSchemas] = await Promise.all([
    resolveRelationSchemaCatalogAt(db, workspace, relationSchemas, parseStateDate(from)),
    resolveRelationSchemaCatalogAt(db, workspace, relationSchemas, parseStateDate(to))
  ]);
  const [fromRelations, toRelations] = await Promise.all([
    reconstructRelationState(db, workspace, authCtx, from, scopes[0]?.projectId, now, fromSchemas),
    reconstructRelationState(db, workspace, authCtx, to, scopes[1]?.projectId, now, toSchemas)
  ]);
  const fromRelationById = new Map(fromRelations.map(relation => [relation.id, relation]));
  const toRelationById = new Map(toRelations.map(relation => [relation.id, relation]));

  const relationSchemaFor = (
    relation: RelationDbResult,
    catalog: HistoricalRelationSchemaCatalog
  ) => catalog.get(relation.schema_id) ?? null;

  const relationsAdded: RelationRecord[] = [...toRelationById.values()]
    .filter(relation => !fromRelationById.has(relation.id))
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(relation =>
      toRedactedApiRelation(relation, authCtx, relationSchemaFor(relation, toRelationSchemas))
    );
  const relationsRemoved: RelationRecord[] = [...fromRelationById.values()]
    .filter(relation => !toRelationById.has(relation.id))
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(relation =>
      toRedactedApiRelation(relation, authCtx, relationSchemaFor(relation, fromRelationSchemas))
    );
  const relationsChanged = [...toRelationById.values()]
    .filter(relation => fromRelationById.has(relation.id))
    .map(relation => ({
      relation,
      diff: buildDiff(relationState(fromRelationById.get(relation.id)!), relationState(relation))
    }))
    .filter(entry => Object.keys(entry.diff).length > 0)
    .sort((a, b) => a.relation.id.localeCompare(b.relation.id))
    .map(entry => {
      const fromRelation = fromRelationById.get(entry.relation.id)!;
      const diff = redactKnownDataDiff(
        entry.diff,
        authCtx,
        relationSchemaFor(fromRelation, fromRelationSchemas),
        relationSchemaFor(entry.relation, toRelationSchemas)
      );
      return {
        relation: toRedactedApiRelation(
          entry.relation,
          authCtx,
          relationSchemaFor(entry.relation, toRelationSchemas)
        ),
        diff
      };
    });

  return {
    added,
    removed,
    changed,
    relations: { added: relationsAdded, removed: relationsRemoved, changed: relationsChanged }
  };
};
