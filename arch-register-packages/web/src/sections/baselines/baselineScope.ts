import type { CreateBaselineRequest } from '@arch-register/api-types/baselineContract';
import type { EntityQuery } from '@arch-register/api-types/entityQueryIR';
import type { FilterCondition } from '@arch-register/api-types/viewContract';
import {
  buildEntityQueryFromBrowserFilters,
  withLiveSearchText
} from '../entities/components/entityBrowserState';

export type EntityBaselineScopeInput = {
  viewId?: string;
  viewName?: string | null;
  collectionId?: string | null;
  collectionName?: string | null;
  entityQuery?: EntityQuery | null;
  typeFilter: string | null;
  conditions: FilterCondition[];
  joinAssessmentId?: string | null;
  q: string;
};

export type EntityBaselineScope = {
  scope: CreateBaselineRequest['scope'];
  query: EntityQuery | null;
  label: string;
  detail: string;
};

const hasScopeQuery = (query: EntityQuery) =>
  query.schemaId != null ||
  query.assessmentId != null ||
  query.projectId != null ||
  query.projectScope != null ||
  query.collectionId != null ||
  query.projections != null ||
  query.root.kind !== 'and' ||
  query.root.children.length > 0;

export const buildEntityBaselineScope = ({
  viewId,
  viewName,
  collectionId,
  collectionName,
  entityQuery,
  typeFilter,
  conditions,
  joinAssessmentId,
  q
}: EntityBaselineScopeInput): EntityBaselineScope => {
  const baseQuery =
    entityQuery ??
    buildEntityQueryFromBrowserFilters({ typeFilter, conditions, joinAssessmentId, q });
  const query = {
    ...withLiveSearchText(baseQuery, entityQuery ? q : ''),
    ...(collectionId ? { collectionId } : {})
  };

  if (viewId) {
    return {
      scope: { kind: 'saved_view', viewId },
      query,
      label: viewName ? `Saved view: ${viewName}` : 'Current saved view',
      detail: 'The baseline will preserve the saved view query at the selected effective date.'
    };
  }

  if (collectionId) {
    return {
      scope: { kind: 'workspace' },
      query,
      label: collectionName ? `Collection: ${collectionName}` : 'Current collection',
      detail: 'The baseline will preserve the collection membership and current filters.'
    };
  }

  if (hasScopeQuery(query)) {
    return {
      scope: { kind: 'workspace' },
      query,
      label: 'Current filters and search',
      detail: 'The baseline will preserve the current filtered entity scope.'
    };
  }

  return {
    scope: { kind: 'workspace' },
    query: null,
    label: 'Entire workspace',
    detail: 'The baseline will include all entities visible in the workspace.'
  };
};
