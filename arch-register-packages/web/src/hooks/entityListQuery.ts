import type { FilterCondition } from '@arch-register/api-types/viewContract';
import type { EntityQuery } from '@arch-register/api-types/entityQueryIR';

export type EntityListOptions = {
  schemaId?: string | null;
  owner?: string | null;
  lifecycle?: string | null;
  q?: string | null;
  conditions?: FilterCondition[];
  entityQuery?: EntityQuery | null;
  assessmentId?: string | null;
  projectId?: string | null;
  projectScope?: 'project' | 'all';
  collectionId?: string | null;
  view?: 'summary' | 'full';
  limit?: number | null;
  offset?: number | null;
  asOf?: string | null;
  includePlannedChanges?: boolean | null;
};

export const toEntityListQuery = (options: EntityListOptions) => ({
  _schemaId: options.schemaId ?? undefined,
  owner: options.owner ?? undefined,
  lifecycle: options.lifecycle ?? undefined,
  q: options.q ?? undefined,
  conditions: options.conditions?.length ? options.conditions : undefined,
  entityQuery: options.entityQuery ? JSON.stringify(options.entityQuery) : undefined,
  assessmentId: options.assessmentId ?? undefined,
  projectId: options.projectId ?? undefined,
  projectScope: options.projectScope ?? undefined,
  collectionId: options.collectionId ?? undefined,
  asOf: options.asOf ?? undefined,
  includePlannedChanges: options.includePlannedChanges ?? undefined
});
