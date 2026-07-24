import type { FilterCondition } from '@arch-register/api-types/viewContract';
import type { EntityQuery, QueryNode } from '@arch-register/api-types/entityQueryIR';
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
  includePlannedChanges?: boolean;
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
    includePlannedChanges: query.entityQuery?.includePlannedChanges ?? query.includePlannedChanges
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
  compare('includePlannedChanges', input.includePlannedChanges, entityQuery.includePlannedChanges);
  return conflicts;
};

/**
 * Produces the structured execution form for the existing HTTP query shape. Legacy `conditions`
 * are always compiled to IR when no explicit `entityQuery` is supplied, including `_completeness`
 * and assessment conditions, which the IR compiler expresses natively in SQL. `owner`/`lifecycle`/`q`
 * are folded into the tree as extra predicate/freeText nodes (rather than left for an in-memory
 * post-filter) whether the request supplied an explicit `entityQuery` or legacy `conditions`.
 */
export const buildEntityQueryForExecution = (
  input: EntityListQueryParams,
  parsed: ParsedEntityQuery
): EntityQuery | null => {
  const base: EntityQuery = input.entityQuery ?? {
    ...filterConditionsToEntityQueryIR(parsed.schemaId, parsed.assessmentId, parsed.conditions),
    ...(parsed.projectId ? { projectId: parsed.projectId } : {}),
    ...(parsed.projectScope ? { projectScope: parsed.projectScope } : {}),
    ...(parsed.asOf ? { asOf: parsed.asOf.toISOString() } : {}),
    ...(parsed.asOf ? { includePlannedChanges: parsed.includePlannedChanges } : {})
  };

  const extra: QueryNode[] = [];
  if (parsed.owner) {
    extra.push({
      kind: 'predicate',
      path: [],
      fieldId: '_owner',
      op: 'equals',
      value: parsed.owner
    });
  }
  if (parsed.lifecycle) {
    extra.push({
      kind: 'predicate',
      path: [],
      fieldId: '_lifecycle',
      op: 'equals',
      value: parsed.lifecycle
    });
  }
  if (parsed.q) {
    extra.push({ kind: 'freeText', value: parsed.q });
  }
  if (extra.length === 0) return base;

  return { ...base, root: { kind: 'and', children: [base.root, ...extra] } };
};
