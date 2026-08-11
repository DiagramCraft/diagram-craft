import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { EntityQuery } from '@arch-register/api-types/entityQueryIR';
import {
  entityTypedRelationsQuery,
  invalidateRelationEndpoints,
  relationDetailQuery,
  relationsQuery,
  relationsStructuredQuery,
  removeRelationDetailCache,
  setRelationDetailCache,
  type RelationQueryFilters
} from '../queries/relations';
import { orpcClient } from '../lib/orpcClient';

// Hook for listing relation instances, optionally filtered by schema/endpoint entity
export const useRelations = (
  workspaceId: string,
  filters: RelationQueryFilters = {},
  queryOptions?: { enabled?: boolean }
) => {
  const query = useQuery(relationsQuery(workspaceId, filters, queryOptions?.enabled ?? true));

  return {
    ...query,
    data: query.data?.items ?? [],
    total: query.data?.total
  };
};

// Hook for browsing relation instances via the relation-rooted structured query engine (#2689) —
// supports filtering/sorting/search on relation fields and endpoint entity fields, unlike
// useRelations' schema/endpoint-only filters.
export const useRelationsQuery = (
  workspaceId: string,
  relationQuery: EntityQuery | null,
  options: { view?: 'summary' | 'full'; limit?: number; offset?: number } = {},
  queryOptions?: { enabled?: boolean }
) => {
  const query = useQuery(
    relationsStructuredQuery(workspaceId, relationQuery, options, queryOptions?.enabled ?? true)
  );

  return {
    ...query,
    data: query.data?.items ?? [],
    total: query.data?.total
  };
};

// Hook for fetching a single relation instance
export const useRelation = (workspaceId: string, relationId: string) => {
  return useQuery(relationDetailQuery(workspaceId, relationId));
};

// Hook for fetching an entity's typed (schema-based) relation instances, grouped by direction
export const useEntityTypedRelations = (workspaceId: string, entityId: string) => {
  return useQuery(entityTypedRelationsQuery(workspaceId, entityId));
};

// Hook for creating a relation instance
export const useCreateRelation = (workspaceId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: {
      _schemaId: string;
      _inEntityId: string;
      _outEntityId: string;
      [fieldId: string]: unknown;
    }) => orpcClient.relations.create({ params: { workspace: workspaceId }, body }),
    onSuccess: async created => {
      await invalidateRelationEndpoints(queryClient, workspaceId, [
        created._in.id,
        created._out.id
      ]);
    }
  });
};

// Hook for updating a relation instance's field values
export const useUpdateRelation = (workspaceId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ relationId, data }: { relationId: string; data: Record<string, unknown> }) =>
      orpcClient.relations.update({
        params: { workspace: workspaceId, id: relationId },
        body: data
      }),
    onSuccess: async updated => {
      setRelationDetailCache(queryClient, workspaceId, updated._uid, updated);
      await invalidateRelationEndpoints(queryClient, workspaceId, [
        updated._in.id,
        updated._out.id
      ]);
    }
  });
};

// Hook for deleting a relation instance
export const useDeleteRelation = (workspaceId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ relationId }: { relationId: string; inEntityId: string; outEntityId: string }) =>
      orpcClient.relations.remove({ params: { workspace: workspaceId, id: relationId } }),
    onSuccess: async (_, variables) => {
      removeRelationDetailCache(queryClient, workspaceId, variables.relationId);
      await invalidateRelationEndpoints(queryClient, workspaceId, [
        variables.inEntityId,
        variables.outEntityId
      ]);
    }
  });
};
