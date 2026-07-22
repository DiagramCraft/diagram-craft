import type { DatabaseAdapter } from '../../db/database';
import type { AuthorizationContext } from '@arch-register/permissions';
import { PermissionChecker } from '@arch-register/permissions';

import { httpAssert } from '../../utils/httpAssert';
import { computeEntityCompleteness } from '../../utils/completeness';
import { requireEntityAction, requireProjectAccess } from '../auth/authorization';
import {
  splitAssessmentConditions,
  matchesAssessmentConditions
} from '@arch-register/api-types/assessmentFilter';
import type { AssessmentDbResult } from '../project/db/projectDatabase';

import { toApiEntity, toApiEntitySummary } from './entityHelpers';
import { decodeRefs } from '../../types';
import { handleError, filterEntities, matchesFilterCondition } from './dataHelpers';
import { ENTITY_DEFAULTS } from '../../constants';
import { EntityFacets, EntityRecord, TreeResponse } from '@arch-register/api-types/entityContract';
import type { FilterCondition } from '@arch-register/api-types/viewContract';
import { listAllCatalogEntities } from './entityLoader';
import { reconstructEntitiesAsOf } from './entitySnapshotReconstruction';
import type { EntityDbResult } from './db/catalogDatabase';

const checker = new PermissionChecker();

type CollectedEntity = {
  entity: EntityRecord;
  completeness: number | null;
};

export type EntityQueryOptions = {
  schemaId?: string | null;
  owner?: string | null;
  lifecycle?: string | null;
  q?: string | null;
  conditions?: FilterCondition[];
  assessmentId?: string | null;
  projectId?: string | null;
  projectScope?: 'project' | 'all';
  collectionId?: string | null;
  view?: 'summary' | 'full';
  limit?: number | null;
  offset?: number | null;
  asOf?: Date | null;
  includeProjectSnapshots?: boolean;
};

export type EntityListPage = {
  items: EntityRecord[];
  total: number;
};

export type NormalizedEntityQueryOptions = {
  schemaId: string | null;
  owner: string | null;
  lifecycle: string | null;
  q: string;
  conditions: FilterCondition[];
  assessmentId: string | null;
  projectId: string | null;
  projectScope: 'project' | 'all';
  collectionId: string | null;
  view: 'summary' | 'full';
  limit: number | null;
  offset: number;
  asOf: Date | null;
  includeProjectSnapshots: boolean;
};

export const normalizeEntityQueryOptions = (
  options: EntityQueryOptions
): NormalizedEntityQueryOptions => ({
  schemaId: options.schemaId ?? null,
  owner: options.owner ?? null,
  lifecycle: options.lifecycle ?? null,
  q: options.q ?? '',
  conditions: options.conditions ?? [],
  assessmentId: options.assessmentId ?? null,
  projectId: options.projectId ?? null,
  projectScope: options.projectScope ?? 'all',
  collectionId: options.collectionId ?? null,
  view: options.view ?? 'full',
  limit: options.limit ?? null,
  offset: options.offset ?? 0,
  asOf: options.asOf ?? null,
  includeProjectSnapshots: options.includeProjectSnapshots ?? true
});

const attachProjectLink = (
  entity: EntityRecord,
  rowId: string,
  projectId: string | null,
  projectEntityMap: Map<
    string,
    { entity_type_id: string | null; entity_type_label: string | null; is_done: boolean }
  >
): EntityRecord => {
  if (!projectId) return entity;
  const projectEntity = projectEntityMap.get(rowId);
  return {
    ...entity,
    _projectLink: projectEntity
      ? {
          linked: true,
          entityType: projectEntity.entity_type_id
            ? {
                id: projectEntity.entity_type_id,
                name: projectEntity.entity_type_label ?? projectEntity.entity_type_id
              }
            : null,
          isDone: projectEntity.is_done
        }
      : { linked: false, entityType: null, isDone: false }
  };
};

/**
 * Resolves the joined assessment's bulk response map when the query includes assessment
 * conditions. Exactly one `listAssessmentResponses` call per request — never per-entity.
 */
export const resolveJoinedAssessment = async (
  db: DatabaseAdapter,
  workspace: string,
  authCtx: AuthorizationContext | null,
  assessmentId: string | null,
  hasAssessmentConditions: boolean
): Promise<{
  assessment: AssessmentDbResult;
  responsesByEntity: Map<string, Record<string, string | number>>;
} | null> => {
  if (!hasAssessmentConditions) return null;
  httpAssert.present(assessmentId, {
    status: 400,
    message: 'Assessment filter conditions require assessmentId'
  });
  const assessment = await db.project.getAssessmentById(workspace, assessmentId);
  httpAssert.present(assessment, {
    status: 404,
    message: `Assessment '${assessmentId}' not found`
  });
  if (authCtx) {
    const project = await db.project.getProject(workspace, assessment.project_id);
    httpAssert.present(project, {
      status: 404,
      message: `Project '${assessment.project_id}' not found`
    });
    requireProjectAccess(authCtx, project.owner);
  }
  const responses = await db.project.listAssessmentResponses(workspace, assessmentId);
  const responsesByEntity = new Map(responses.map(r => [r.entity_id, r.values]));
  return { assessment, responsesByEntity };
};

export const listEntitiesWithCount = async (
  db: DatabaseAdapter,
  workspace: string,
  authCtx: AuthorizationContext | null,
  options: EntityQueryOptions
): Promise<EntityListPage> => {
  const { limit, offset, ...queryOptions } = normalizeEntityQueryOptions(options);
  const safeOffset = Math.max(Math.trunc(offset ?? 0), 0);
  const safeLimit = limit == null ? null : Math.max(Math.trunc(limit), 1);
  try {
    const rows = await collectEntities(db, workspace, authCtx, queryOptions);
    const windowed =
      safeLimit != null ? rows.slice(safeOffset, safeOffset + safeLimit) : rows.slice(safeOffset);
    return {
      items: windowed.map(row => row.entity),
      total: rows.length
    };
  } catch (error) {
    return handleError(error, 'Failed to retrieve data');
  }
};

export const listEntities = async (
  db: DatabaseAdapter,
  workspace: string,
  authCtx: AuthorizationContext | null,
  options: EntityQueryOptions
): Promise<EntityRecord[]> => {
  const page = await listEntitiesWithCount(db, workspace, authCtx, options);
  return page.items;
};

export const countEntities = async (
  db: DatabaseAdapter,
  workspace: string,
  authCtx: AuthorizationContext | null,
  options: Omit<EntityQueryOptions, 'view' | 'limit' | 'offset'>
): Promise<number> => {
  const rows = await collectEntities(db, workspace, authCtx, { ...options, view: 'full' });
  return rows.length;
};

const collectEntities = async (
  db: DatabaseAdapter,
  workspace: string,
  authCtx: AuthorizationContext | null,
  options: EntityQueryOptions
): Promise<CollectedEntity[]> => {
  const {
    schemaId,
    owner,
    lifecycle,
    q,
    conditions,
    assessmentId,
    projectId,
    projectScope,
    collectionId,
    view,
    asOf,
    includeProjectSnapshots
  } = normalizeEntityQueryOptions(options);
  // _completeness is computed post-fetch; assessment conditions are evaluated against the
  // joined assessment's bulk response map; all remaining conditions can be evaluated in SQL
  const { assessmentConditions, otherConditions } = splitAssessmentConditions(conditions);
  const sqlConditions = otherConditions.filter(c => c.fieldId !== '_completeness');
  const completenessConditions = otherConditions.filter(c => c.fieldId === '_completeness');
  const [schemas, projectEntities, joinedAssessment, collectionEntityIds] = await Promise.all([
    db.catalog.listSchemas(workspace),
    projectId ? db.project.listProjectEntities(workspace, projectId) : Promise.resolve([]),
    resolveJoinedAssessment(db, workspace, authCtx, assessmentId, assessmentConditions.length > 0),
    collectionId && authCtx
      ? db.view.listCollectionEntityIds(authCtx.userId, workspace, collectionId)
      : Promise.resolve(null)
  ]);
  const collectionEntityIdSet = collectionEntityIds == null ? null : new Set(collectionEntityIds);
  const schemaMap = new Map(schemas.map(s => [s.id, s]));
  const projectEntityMap = new Map(projectEntities.map(entity => [entity.entity_id, entity]));
  const rows: CollectedEntity[] = [];

  const hasWorkspaceWideView = authCtx != null && checker.hasWorkspaceWideEntityView(authCtx);

  const processEntity = (entity: EntityDbResult, extraConditions: FilterCondition[]) => {
    if (
      authCtx &&
      !hasWorkspaceWideView &&
      !checker.hasEntityPermission(authCtx, entity, 'view_entity')
    )
      return;
    if (collectionEntityIdSet && !collectionEntityIdSet.has(entity.id)) return;

    const schema = schemaMap.get(entity.schema_id);
    const completeness = schema != null ? computeEntityCompleteness(entity, schema) : null;
    if (
      extraConditions.length > 0 &&
      !extraConditions.every(c => matchesFilterCondition(entity, c, completeness))
    ) {
      return;
    }
    if (
      joinedAssessment &&
      !matchesAssessmentConditions(
        joinedAssessment.responsesByEntity.get(entity.id),
        assessmentConditions,
        joinedAssessment.assessment.fields
      )
    ) {
      return;
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
  };

  if (asOf) {
    let candidateEntityIds: string[] | undefined;
    if (projectId && projectScope === 'project') {
      const links = await db.project.listProjectEntityLinks(workspace, projectId);
      candidateEntityIds = links
        .filter(link => link.created_at <= asOf)
        .map(link => link.entity_id);
    }
    const reconstructed = await reconstructEntitiesAsOf(
      db,
      workspace,
      asOf,
      authCtx,
      candidateEntityIds,
      includeProjectSnapshots
    );
    const filtered = filterEntities(reconstructed, { schemaId, owner, lifecycle, q: q ?? '' });
    for (const entity of filtered) {
      processEntity(entity, conditions);
    }
    return rows;
  }

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
        conditions: sqlConditions,
        projectId,
        projectScope
      },
      {
        limit: dbPageSize,
        offset: dbOffset
      }
    );

    if (page.length === 0) break;

    for (const entity of page) {
      processEntity(entity, completenessConditions);
    }

    if (page.length < dbPageSize) break;
    dbOffset += dbPageSize;
  }

  return rows;
};

export const getTimelineMarkers = async (db: DatabaseAdapter, workspace: string) => {
  try {
    return await db.catalog.listTimelineMarkers(workspace);
  } catch (error) {
    return handleError(error, 'Failed to retrieve timeline markers');
  }
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
    const entities =
      authCtx == null || checker.hasWorkspaceWideEntityView(authCtx)
        ? allEntities
        : allEntities.filter(entity => checker.hasEntityPermission(authCtx, entity, 'view_entity'));

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
    conditions?: FilterCondition[];
    assessmentId?: string | null;
  }
): Promise<TreeResponse> => {
  const {
    schemaId = null,
    owner = null,
    lifecycle = null,
    q = '',
    projectId = null,
    projectScope = 'all',
    conditions = [],
    assessmentId = null
  } = options;
  try {
    const { assessmentConditions, otherConditions } = splitAssessmentConditions(conditions);
    const [schemas, allEntitiesRaw, projectEntities, joinedAssessment] = await Promise.all([
      db.catalog.listSchemas(workspace),
      listAllCatalogEntities(db, workspace, { projectId, projectScope }),
      projectId ? db.project.listProjectEntities(workspace, projectId) : Promise.resolve([]),
      resolveJoinedAssessment(db, workspace, authCtx, assessmentId, assessmentConditions.length > 0)
    ]);
    const projectEntityMap = new Map(projectEntities.map(entity => [entity.entity_id, entity]));
    const scopedEntities =
      authCtx == null || checker.hasWorkspaceWideEntityView(authCtx)
        ? allEntitiesRaw
        : allEntitiesRaw.filter(entity => checker.hasEntityPermission(authCtx, entity, 'view_entity'));

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

    const schemaMap = new Map(schemas.map(s => [s.id, s]));
    const hasCompletenessCondition = otherConditions.some(c => c.fieldId === '_completeness');

    const matchRows = filterEntities(scopedEntities, {
      schemaId,
      owner,
      lifecycle,
      q: q ?? ''
    })
      .filter(entity => {
        if (otherConditions.length === 0 && !joinedAssessment) return true;
        const schema = schemaMap.get(entity.schema_id) ?? null;
        const completeness =
          hasCompletenessCondition && schema != null
            ? computeEntityCompleteness(entity, schema)
            : null;
        if (!otherConditions.every(c => matchesFilterCondition(entity, c, completeness)))
          return false;
        if (
          joinedAssessment &&
          !matchesAssessmentConditions(
            joinedAssessment.responsesByEntity.get(entity.id),
            assessmentConditions,
            joinedAssessment.assessment.fields
          )
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
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
        ...attachProjectLink(toApiEntity(row, authCtx), row.id, projectId, projectEntityMap),
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
