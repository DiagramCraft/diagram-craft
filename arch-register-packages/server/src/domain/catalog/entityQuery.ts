import type { FilterCondition } from '@arch-register/api-types/viewContract';
import type { EntityQuery } from '@arch-register/api-types/entityQueryIR';
import { isAssessmentCondition } from '@arch-register/api-types/assessmentFilter';
import { filterConditionsToEntityQueryIR } from './entityQueryIRMapping';
import {
  normalizeEntityQueryOptions,
  type NormalizedEntityQueryOptions
} from './entityQueryOperations';

// HTTP query-param shape for listEntities/countEntities, distinct from the structured
// `EntityQuery` IR type in `@arch-register/api-types/entityQueryIR`.
export type EntityListQueryParams = {
  _schemaId?: string;
  owner?: string;
  lifecycle?: string;
  q?: string;
  conditions?: FilterCondition[];
  entityQuery?: EntityQuery;
  assessmentId?: string;
  projectId?: string;
  projectScope?: 'project' | 'all';
  collectionId?: string;
  view?: 'summary' | 'full';
  limit?: number;
  offset?: number;
  asOf?: string;
  includeProjectSnapshots?: boolean;
};

const parseAsOf = (value: string | undefined): Date | null => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const parseEntityQuery = (query: EntityListQueryParams): NormalizedEntityQueryOptions =>
  normalizeEntityQueryOptions({
    entityQuery: query.entityQuery,
    schemaId: query.entityQuery?.schemaId ?? query._schemaId,
    owner: query.owner,
    lifecycle: query.lifecycle,
    q: query.q,
    conditions: query.conditions,
    assessmentId: query.entityQuery?.assessmentId ?? query.assessmentId,
    projectId: query.entityQuery?.projectId ?? query.projectId,
    projectScope: query.entityQuery?.projectScope ?? query.projectScope,
    collectionId: query.collectionId,
    view: query.view,
    limit: query.limit,
    offset: query.offset,
    asOf: parseAsOf(query.entityQuery?.asOf ?? query.asOf),
    includeProjectSnapshots:
      query.entityQuery?.includeProjectSnapshots ?? query.includeProjectSnapshots
  });

export type ParsedEntityQuery = ReturnType<typeof parseEntityQuery>;

export const findEntityQueryRequestConflicts = (input: EntityListQueryParams): string[] => {
  const entityQuery = input.entityQuery;
  if (!entityQuery) return [];

  const conflicts: string[] = [];
  if (input.conditions) conflicts.push('conditions');

  const compare = (legacyField: string, legacyValue: unknown, irValue: unknown) => {
    if (legacyValue != null && irValue != null && legacyValue !== irValue) {
      conflicts.push(legacyField);
    }
  };

  compare('_schemaId', input._schemaId, entityQuery.schemaId);
  compare('assessmentId', input.assessmentId, entityQuery.assessmentId);
  compare('projectId', input.projectId, entityQuery.projectId);
  compare('projectScope', input.projectScope, entityQuery.projectScope);
  compare('asOf', input.asOf, entityQuery.asOf);
  compare(
    'includeProjectSnapshots',
    input.includeProjectSnapshots,
    entityQuery.includeProjectSnapshots
  );
  return conflicts;
};

/**
 * Produces the structured execution form for the existing HTTP query shape. Legacy conditions that
 * depend on the in-memory assessment/completeness seams remain on the legacy path until those
 * evaluators are available for arbitrary IR trees.
 */
export const buildEntityQueryForExecution = (
  input: EntityListQueryParams,
  parsed: ParsedEntityQuery
): EntityQuery | null => {
  if (input.entityQuery) return input.entityQuery;
  if (
    parsed.conditions.some(
      condition => condition.fieldId === '_completeness' || isAssessmentCondition(condition)
    )
  ) {
    return null;
  }

  const mapped = filterConditionsToEntityQueryIR(
    parsed.schemaId,
    parsed.assessmentId,
    parsed.conditions
  );
  return {
    ...mapped,
    ...(parsed.projectId ? { projectId: parsed.projectId } : {}),
    ...(parsed.projectScope ? { projectScope: parsed.projectScope } : {}),
    ...(parsed.asOf ? { asOf: parsed.asOf.toISOString() } : {}),
    ...(parsed.asOf ? { includeProjectSnapshots: parsed.includeProjectSnapshots } : {})
  };
};
