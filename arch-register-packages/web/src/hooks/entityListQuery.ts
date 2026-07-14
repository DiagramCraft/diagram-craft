import type { FilterCondition } from '@arch-register/api-types/viewContract';

export type EntityListOptions = {
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
  asOf?: string | null;
  includeProjectSnapshots?: boolean | null;
};

export const toEntityListQuery = (options: EntityListOptions) => ({
  _schemaId: options.schemaId ?? undefined,
  owner: options.owner ?? undefined,
  lifecycle: options.lifecycle ?? undefined,
  q: options.q ?? undefined,
  conditions: options.conditions?.length ? options.conditions : undefined,
  assessmentId: options.assessmentId ?? undefined,
  projectId: options.projectId ?? undefined,
  projectScope: options.projectScope ?? undefined,
  collectionId: options.collectionId ?? undefined,
  asOf: options.asOf ?? undefined,
  includeProjectSnapshots: options.includeProjectSnapshots ?? undefined
});
