import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import { entitiesQuery } from '../../queries/entities';
import { useSchemas } from '../../hooks/useSchemas';
import {
  useApiEndpointRelations,
  groupByApiId,
  rankMostConsumedApis
} from './apiEndpointRelations';
import { useSpecificationItemCounts } from '../../hooks/useSpecificationRevisions';
import { useResolvedApiIntegrationCatalogConfig } from './useResolvedApiIntegrationCatalogConfig';

export type MostConsumedApi = {
  entity: EntityRecord;
  consumerCount: number;
  operationsCount: number | null;
};

/**
 * Self-fetching data for the Overview's "Most consumed APIs" panel (#3458) — resolves the API
 * schema itself internally (via `apiSchemaId`) rather than taking `EntitySchema[]` as a prop, so
 * this hook (and the panel using it) stays a small id-based contract like `ApiBlastRadiusPanel`'s.
 */
export const useMostConsumedApis = (
  workspaceId: string,
  apiSchemaId: string | null,
  limit = 6
): { status: 'loading' | 'error' | 'empty' | 'ready'; items: MostConsumedApi[] } => {
  const config = useResolvedApiIntegrationCatalogConfig(workspaceId);
  const resolvedApiSchemaId = apiSchemaId ?? config.apiConfig?.apiSchemaId ?? null;
  const schemas = useSchemas(workspaceId);
  const apiSchema = schemas.data?.find(schema => schema.id === resolvedApiSchemaId);

  const apis = useQuery(
    entitiesQuery(
      workspaceId,
      { schemaId: resolvedApiSchemaId ?? undefined, view: 'full', limit: 500 },
      resolvedApiSchemaId != null
    )
  );
  const allApis = apis.data?.items ?? [];

  const { consumers, isLoading: consumersLoading } = useApiEndpointRelations(
    workspaceId,
    apiSchema
  );
  const consumersByApi = useMemo(() => groupByApiId(consumers), [consumers]);
  const apiIds = useMemo(() => allApis.map(entity => entity._uid), [allApis]);
  const operationsCounts = useSpecificationItemCounts(workspaceId, apiIds);

  const ranked = useMemo(
    () => rankMostConsumedApis(allApis, consumersByApi, limit),
    [allApis, consumersByApi, limit]
  );

  const isLoading = config.isLoading || schemas.isLoading || apis.isLoading || consumersLoading;
  const isError = config.isError || apis.isError;

  const items: MostConsumedApi[] = ranked.map(entity => ({
    entity,
    consumerCount: consumersByApi.get(entity._uid)?.length ?? 0,
    operationsCount: operationsCounts.byId.get(entity._uid) ?? null
  }));

  return {
    status: isError ? 'error' : isLoading ? 'loading' : items.length === 0 ? 'empty' : 'ready',
    items
  };
};
