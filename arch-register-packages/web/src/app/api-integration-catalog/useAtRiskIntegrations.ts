import { useMemo } from 'react';
import { useRelations } from '../../hooks/useRelations';
import { useDataFlowConfig } from './useDataFlowConfig';
import { selectAtRiskIntegrations, type AtRiskIntegration } from './apiIntegrationCatalogStatsHelpers';

/**
 * Self-fetching data for the Overview's "Integrations needing attention" panel (#3458) — resolves
 * Data Flow configuration and relations internally, independent of the stat tiles' own fetch of the
 * same underlying data (React Query dedupes the overlapping query keys).
 */
export const useAtRiskIntegrations = (
  workspaceId: string,
  limit = 8
): {
  status: 'loading' | 'error' | 'empty' | 'ready';
  items: AtRiskIntegration[];
  dataFlowConfigured: boolean;
} => {
  const dataFlowConfig = useDataFlowConfig(workspaceId);
  const relations = useRelations(
    workspaceId,
    { schemaId: dataFlowConfig.data?.relationSchemaId, limit: 500 },
    { enabled: dataFlowConfig.data != null }
  );

  const items = useMemo(
    () => selectAtRiskIntegrations(relations.data, limit),
    [relations.data, limit]
  );

  const isLoading = dataFlowConfig.isLoading || relations.isLoading;
  const dataFlowConfigured = dataFlowConfig.data != null;

  return {
    status: relations.isError
      ? 'error'
      : isLoading
        ? 'loading'
        : dataFlowConfigured && items.length === 0
          ? 'empty'
          : 'ready',
    items,
    dataFlowConfigured
  };
};
