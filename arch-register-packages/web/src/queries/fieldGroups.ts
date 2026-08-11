import { queryOptions, type QueryClient } from '@tanstack/react-query';
import { schemaKeys } from './schemaKeys';
import { orpcClient } from '../lib/orpcClient';

export const fieldGroupKeys = {
  all: ['fieldgroups'] as const,
  lists: () => [...fieldGroupKeys.all, 'list'] as const,
  list: (workspaceId: string) => [...fieldGroupKeys.lists(), workspaceId] as const,
  details: () => [...fieldGroupKeys.all, 'detail'] as const,
  detail: (workspaceId: string, fieldGroupId: string) =>
    [...fieldGroupKeys.details(), workspaceId, fieldGroupId] as const
};

export const fieldGroupsQuery = (workspaceId: string, enabled = true) =>
  queryOptions({
    queryKey: fieldGroupKeys.list(workspaceId),
    queryFn: () => orpcClient.fieldGroups.list({ params: { workspace: workspaceId } }),
    enabled: enabled && !!workspaceId,
    staleTime: 5 * 60 * 1000
  });

export const invalidateDeletedFieldGroup = async (
  queryClient: QueryClient,
  workspaceId: string,
  fieldGroupId: string
) => {
  await queryClient.invalidateQueries({ queryKey: fieldGroupKeys.list(workspaceId) });
  queryClient.removeQueries({ queryKey: fieldGroupKeys.detail(workspaceId, fieldGroupId) });
};

export const invalidateFieldGroupQueries = async (
  queryClient: QueryClient,
  workspaceId: string,
  fieldGroupId?: string
) => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: fieldGroupKeys.list(workspaceId) }),
    ...(fieldGroupId
      ? [
          queryClient.invalidateQueries({
            queryKey: fieldGroupKeys.detail(workspaceId, fieldGroupId)
          }),
          queryClient.invalidateQueries({ queryKey: schemaKeys.list(workspaceId) })
        ]
      : [])
  ]);
};
