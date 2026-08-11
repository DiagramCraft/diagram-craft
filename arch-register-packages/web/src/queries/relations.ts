import { queryOptions, type QueryClient } from '@tanstack/react-query';
import type { RelationListFilters } from '@arch-register/api-types/relationContract';
import type { EntityQuery } from '@arch-register/api-types/entityQueryIR';
import { entityKeys } from './entities';
import { orpcClient } from '../lib/orpcClient';

export const relationKeys = {
  all: ['relations'] as const,
  lists: () => [...relationKeys.all, 'list'] as const,
  workspaceLists: (workspaceId: string) => [...relationKeys.lists(), workspaceId] as const,
  list: (workspaceId: string, filters: Record<string, unknown>) =>
    [...relationKeys.workspaceLists(workspaceId), filters] as const,
  details: () => [...relationKeys.all, 'detail'] as const,
  workspaceDetails: (workspaceId: string) => [...relationKeys.details(), workspaceId] as const,
  detail: (workspaceId: string, relationId: string) =>
    [...relationKeys.workspaceDetails(workspaceId), relationId] as const
};

export type RelationQueryFilters = RelationListFilters & { limit?: number; offset?: number };

export const relationsQuery = (
  workspaceId: string,
  filters: RelationQueryFilters = {},
  enabled = true
) =>
  queryOptions({
    queryKey: relationKeys.list(workspaceId, filters),
    queryFn: () =>
      orpcClient.relations.list({ params: { workspace: workspaceId }, query: filters }),
    enabled: enabled && !!workspaceId
  });

export const relationsStructuredQuery = (
  workspaceId: string,
  relationQuery: EntityQuery | null,
  options: { view?: 'summary' | 'full'; limit?: number; offset?: number } = {},
  enabled = true
) =>
  queryOptions({
    queryKey: relationKeys.list(workspaceId, { relationQuery, ...options }),
    queryFn: () =>
      orpcClient.relations.query({
        params: { workspace: workspaceId },
        query: { relationQuery: JSON.stringify(relationQuery!), ...options }
      }),
    enabled: enabled && !!workspaceId && relationQuery != null
  });

export const relationDetailQuery = (workspaceId: string, relationId: string) =>
  queryOptions({
    queryKey: relationKeys.detail(workspaceId, relationId),
    queryFn: () => orpcClient.relations.get({ params: { workspace: workspaceId, id: relationId } }),
    enabled: !!workspaceId && !!relationId
  });

export const entityTypedRelationsQuery = (workspaceId: string, entityId: string) =>
  queryOptions({
    queryKey: entityKeys.typedRelations(workspaceId, entityId),
    queryFn: () =>
      orpcClient.relations.listForEntity({ params: { workspace: workspaceId, id: entityId } }),
    enabled: !!workspaceId && !!entityId
  });

export const invalidateRelationEndpoints = async (
  queryClient: QueryClient,
  workspaceId: string,
  entityIds: string[]
) =>
  Promise.all([
    queryClient.invalidateQueries({ queryKey: relationKeys.workspaceLists(workspaceId) }),
    queryClient.invalidateQueries({ queryKey: entityKeys.workspaceBatchRelations(workspaceId) }),
    ...entityIds.map(entityId =>
      queryClient.invalidateQueries({ queryKey: entityKeys.detail(workspaceId, entityId) })
    ),
    ...entityIds.map(entityId =>
      queryClient.invalidateQueries({ queryKey: entityKeys.typedRelations(workspaceId, entityId) })
    ),
    ...entityIds.map(entityId =>
      queryClient.invalidateQueries({ queryKey: entityKeys.relations(workspaceId, entityId) })
    ),
    ...entityIds.map(entityId =>
      queryClient.invalidateQueries({ queryKey: entityKeys.json(workspaceId, entityId, 1) })
    )
  ]);

export const setRelationDetailCache = (
  queryClient: QueryClient,
  workspaceId: string,
  relationId: string,
  relation: unknown
) => queryClient.setQueryData(relationKeys.detail(workspaceId, relationId), relation);

export const removeRelationDetailCache = (
  queryClient: QueryClient,
  workspaceId: string,
  relationId: string
) => queryClient.removeQueries({ queryKey: relationKeys.detail(workspaceId, relationId) });

export const invalidateRelationSchemaConsumers = (queryClient: QueryClient, workspaceId: string) =>
  Promise.all([
    queryClient.invalidateQueries({ queryKey: relationKeys.workspaceLists(workspaceId) }),
    queryClient.invalidateQueries({ queryKey: entityKeys.workspaceRelations(workspaceId) }),
    queryClient.invalidateQueries({ queryKey: entityKeys.workspaceTypedRelations(workspaceId) }),
    queryClient.invalidateQueries({ queryKey: entityKeys.workspaceBatchRelations(workspaceId) })
  ]);
