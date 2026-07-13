import type { FilterCondition } from '@arch-register/api-types/viewContract';

type EntityQuery = {
  _schemaId?: string;
  owner?: string;
  lifecycle?: string;
  q?: string;
  conditions?: FilterCondition[];
  assessmentId?: string;
  projectId?: string;
  projectScope?: 'project' | 'all';
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

export const parseEntityQuery = (query: EntityQuery) => ({
  schemaId: query._schemaId ?? null,
  owner: query.owner ?? null,
  lifecycle: query.lifecycle ?? null,
  q: query.q ?? '',
  conditions: query.conditions ?? [],
  assessmentId: query.assessmentId ?? null,
  projectId: query.projectId ?? null,
  projectScope: query.projectScope ?? 'all',
  view: query.view ?? 'full',
  limit: query.limit ?? null,
  offset: query.offset ?? 0,
  asOf: parseAsOf(query.asOf),
  includeProjectSnapshots: query.includeProjectSnapshots ?? true
});

export type ParsedEntityQuery = ReturnType<typeof parseEntityQuery>;
