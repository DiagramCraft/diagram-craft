import { useMemo } from 'react';
import { useSchemas } from '../../hooks/useSchemas';
import { useRelations } from '../../hooks/useRelations';
import { useResolvedApiIntegrationCatalogConfig } from './useResolvedApiIntegrationCatalogConfig';
import { useDataFlowConfig } from './useDataFlowConfig';
import { useApiEndpointRelations } from './apiEndpointRelations';
import { computeApiPairs, computeApiPairCoverage } from './apiPairCoverage';
import { classifyDataFlowRelations } from './apiIntegrationCatalogStatsHelpers';
import { useApiIntegrationCatalogQueue } from './apiIntegrationCatalogQueue';

export type ApiIntegrationCatalogStatTiles = {
  status: 'loading' | 'error' | 'ready';
  needsAttentionCount: number;
  dataFlowConfigured: boolean;
  crossingCount: number;
  restrictedCount: number;
  highlySensitiveCount: number;
  gapPairs: number;
  coveredPairs: number;
  applicablePairs: number;
};

/**
 * Self-fetching data for the Overview's 4 stat tiles — pulled out of
 * the former Overview screen's screen-level `useQuery`/`useMemo`
 * orchestration so the tiles are a standalone, composable unit (#3458). Independently resolves the
 * same capability config, Data Flow relations, and provider/consumer relations the Screen and other
 * extracted panels also fetch — React Query dedupes the overlapping query keys.
 */
export const useApiIntegrationCatalogStatTiles = (
  workspaceId: string
): ApiIntegrationCatalogStatTiles => {
  const config = useResolvedApiIntegrationCatalogConfig(workspaceId);
  const schemas = useSchemas(workspaceId);
  const apiSchema = schemas.data?.find(schema => schema.id === config.apiConfig?.apiSchemaId);

  const queue = useApiIntegrationCatalogQueue(
    workspaceId,
    config.apiConfig?.apiSchemaId ?? null,
    config.apiConfig != null
  );

  const dataFlowConfig = useDataFlowConfig(workspaceId);
  const relations = useRelations(
    workspaceId,
    { schemaId: dataFlowConfig.data?.relationSchemaId, limit: 500 },
    { enabled: dataFlowConfig.data != null }
  );
  const { crossing, restricted, highlySensitiveCount } = useMemo(
    () => classifyDataFlowRelations(relations.data),
    [relations.data]
  );

  const { providers, consumers } = useApiEndpointRelations(workspaceId, apiSchema);
  const pairs = useMemo(
    () => computeApiPairs(providers, consumers, relations.data),
    [providers, consumers, relations.data]
  );
  const coverage = useMemo(() => computeApiPairCoverage(pairs), [pairs]);

  const isLoading =
    config.isLoading ||
    schemas.isLoading ||
    queue.isLoading ||
    dataFlowConfig.isLoading ||
    relations.isLoading;
  const isError = config.isError || queue.isError || relations.isError;

  return {
    status: isError ? 'error' : isLoading ? 'loading' : 'ready',
    needsAttentionCount: queue.items.length,
    dataFlowConfigured: dataFlowConfig.data != null,
    crossingCount: crossing.length,
    restrictedCount: restricted.length,
    highlySensitiveCount,
    gapPairs: coverage.gapPairs,
    coveredPairs: coverage.coveredPairs,
    applicablePairs: coverage.applicablePairs
  };
};
