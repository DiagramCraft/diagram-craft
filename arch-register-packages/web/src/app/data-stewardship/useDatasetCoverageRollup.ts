import type { EntityRecord } from '@arch-register/api-types/entityContract';
import { useEntity } from '../../hooks/useEntities';
import { computeDatasetCoverage, type DatasetCoverageResult } from './datasetCoverage';

export type DatasetCoverageRollup = DatasetCoverageResult & {
  entity: EntityRecord | undefined;
  isLoading: boolean;
  error: Error | null;
};

const EMPTY: DatasetCoverageRollup = {
  dsCovered: false,
  dsGaps: [],
  entity: undefined,
  isLoading: false,
  error: null
};

/**
 * Singular coverage roll-up for the `DatasetDrawer`. Unlike `useRiskCoverageRollup.ts`, this needs
 * no relation traversal — every field `computeDatasetCoverage` needs (`_owner`, `steward`,
 * `classification`, `review_status`) already lives on the dataset's own entity record, so one
 * `useEntity` fetch is enough.
 */
export const useDatasetCoverageRollup = (
  workspaceId: string,
  datasetId: string | null
): DatasetCoverageRollup => {
  const query = useEntity(workspaceId, datasetId ?? '');
  if (!datasetId) return EMPTY;

  const entity = query.data;
  const coverage = entity
    ? computeDatasetCoverage({
        owner: entity._owner,
        steward: entity.steward,
        classification: entity.classification,
        reviewStatus: entity.review_status
      })
    : { dsCovered: false, dsGaps: [] };

  const error =
    query.error instanceof Error
      ? query.error
      : query.error
        ? new Error(String(query.error))
        : null;

  return { ...coverage, entity, isLoading: query.isLoading, error };
};
