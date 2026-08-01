import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { RelationListFilters } from '@arch-register/api-types/relationContract';
import { relationKeys } from '../queries/relations';
import { entityKeys } from '../queries/entities';
import { orpcClient } from '../lib/orpcClient';

// Hook for listing relation instances, optionally filtered by schema/endpoint entity
export const useRelations = (
  workspaceId: string,
  filters: RelationListFilters & { limit?: number; offset?: number } = {},
  queryOptions?: { enabled?: boolean }
) => {
  const query = useQuery({
    queryKey: relationKeys.list(workspaceId, filters),
    queryFn: () =>
      orpcClient.relations.list({
        params: { workspace: workspaceId },
        query: filters
      }),
    enabled: queryOptions?.enabled ?? !!workspaceId
  });

  return {
    ...query,
    data: query.data?.items ?? [],
    total: query.data?.total
  };
};

// Hook for fetching a single relation instance
export const useRelation = (workspaceId: string, relationId: string) => {
  return useQuery({
    queryKey: relationKeys.detail(workspaceId, relationId),
    queryFn: () => orpcClient.relations.get({ params: { workspace: workspaceId, id: relationId } }),
    enabled: !!workspaceId && !!relationId
  });
};

// Hook for fetching an entity's typed (schema-based) relation instances, grouped by direction
export const useEntityTypedRelations = (workspaceId: string, entityId: string) => {
  return useQuery({
    queryKey: entityKeys.typedRelations(workspaceId, entityId),
    queryFn: () =>
      orpcClient.relations.listForEntity({ params: { workspace: workspaceId, id: entityId } }),
    enabled: !!workspaceId && !!entityId
  });
};

const invalidateRelationEndpoints = async (
  queryClient: ReturnType<typeof useQueryClient>,
  workspaceId: string,
  entityIds: string[]
) => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: relationKeys.lists() }),
    ...entityIds.map(entityId =>
      queryClient.invalidateQueries({ queryKey: entityKeys.typedRelations(workspaceId, entityId) })
    )
  ]);
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
    mutationFn: ({
      relationId,
      data
    }: {
      relationId: string;
      data: Record<string, unknown>;
    }) => orpcClient.relations.update({ params: { workspace: workspaceId, id: relationId }, body: data }),
    onSuccess: async updated => {
      queryClient.setQueryData(relationKeys.detail(workspaceId, updated._uid), updated);
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
      queryClient.removeQueries({ queryKey: relationKeys.detail(workspaceId, variables.relationId) });
      await invalidateRelationEndpoints(queryClient, workspaceId, [
        variables.inEntityId,
        variables.outEntityId
      ]);
    }
  });
};
