import { useMemo } from 'react';
import { useEntities } from '../../hooks/useEntities';
import {
  computeDatasetCoverage,
  computeDatasetCoverageSummary,
  type DatasetCoverageDomainSummary,
  type DatasetCoverageResult
} from './datasetCoverage';

export type DatasetCoverageRollups = {
  byId: Map<string, DatasetCoverageResult>;
  summary: DatasetCoverageDomainSummary[];
  isLoading: boolean;
  error: Error | null;
};

const EMPTY: DatasetCoverageRollups = {
  byId: new Map(),
  summary: [],
  isLoading: false,
  error: null
};

/**
 * Batched dataset coverage rollup for table/overview screens. Unlike
 * `useRiskCoverageRollups.ts`, which fetches relations, this fetches the Data Entities themselves
 * (one `entities.list` request scoped to the workspace's `data-stewardship` schema binding) since
 * coverage is computed entirely off each entity's own fields.
 */
export const useDatasetCoverageRollups = (
  workspaceId: string,
  dataEntitySchemaId: string | null
): DatasetCoverageRollups => {
  const enabled = !!dataEntitySchemaId;
  const query = useEntities(
    workspaceId,
    { schemaId: dataEntitySchemaId ?? undefined, limit: 1000 },
    { enabled }
  );

  const byId = useMemo(() => {
    const map = new Map<string, DatasetCoverageResult>();
    for (const entity of query.data) {
      map.set(
        entity._uid,
        computeDatasetCoverage({
          owner: entity._owner,
          steward: entity.steward,
          classification: entity.classification,
          reviewStatus: entity.review_status
        })
      );
    }
    return map;
  }, [query.data]);

  const summary = useMemo(
    () =>
      computeDatasetCoverageSummary(
        query.data.map(entity => ({
          owner: entity._owner,
          steward: entity.steward,
          classification: entity.classification,
          reviewStatus: entity.review_status
        }))
      ),
    [query.data]
  );

  if (!enabled) return EMPTY;

  const error =
    query.error instanceof Error
      ? query.error
      : query.error
        ? new Error(String(query.error))
        : null;

  return { byId, summary, isLoading: query.isLoading, error };
};
