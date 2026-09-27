import { useQuery } from '@tanstack/react-query';
import { workspaceCapabilityConfigurationsQuery } from '../../queries/workspaceConfig';
import {
  resolveApiIntegrationCatalogConfig,
  type ApiIntegrationCatalogConfig
} from './apiIntegrationCatalogQueries';

/**
 * Resolves the workspace's `api-specification` capability configuration into the entity-schema id
 * the app's panels need — shared by the self-fetching panels so each doesn't repeat the same
 * two-line capability-config resolve independently (the underlying query is deduped by React Query
 * regardless, this just avoids duplicating the resolve logic itself).
 */
export const useResolvedApiIntegrationCatalogConfig = (
  workspaceId: string
): { apiConfig: ApiIntegrationCatalogConfig | null; isLoading: boolean; isError: boolean } => {
  const configurations = useQuery(workspaceCapabilityConfigurationsQuery(workspaceId));
  return {
    apiConfig: resolveApiIntegrationCatalogConfig(configurations.data),
    isLoading: configurations.isLoading,
    isError: configurations.isError
  };
};
