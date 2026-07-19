import type { FilterCondition } from '@arch-register/api-types/viewContract';
import { normalizeEntityQueryOptions, type NormalizedEntityQueryOptions } from './entityOperations';

type EntityQuery = {
  _schemaId?: string;
  owner?: string;
  lifecycle?: string;
  q?: string;
  conditions?: FilterCondition[];
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

export const parseEntityQuery = (query: EntityQuery): NormalizedEntityQueryOptions =>
  normalizeEntityQueryOptions({
    schemaId: query._schemaId,
    owner: query.owner,
    lifecycle: query.lifecycle,
    q: query.q,
    conditions: query.conditions,
    assessmentId: query.assessmentId,
    projectId: query.projectId,
    projectScope: query.projectScope,
    collectionId: query.collectionId,
    view: query.view,
    limit: query.limit,
    offset: query.offset,
    asOf: parseAsOf(query.asOf),
    includeProjectSnapshots: query.includeProjectSnapshots
  });

export type ParsedEntityQuery = ReturnType<typeof parseEntityQuery>;
