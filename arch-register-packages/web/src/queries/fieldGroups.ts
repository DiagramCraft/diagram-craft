import type { QueryClient } from '@tanstack/react-query';

export const fieldGroupKeys = {
  all: ['fieldgroups'] as const,
  lists: () => [...fieldGroupKeys.all, 'list'] as const,
  list: (workspaceId: string) => [...fieldGroupKeys.lists(), workspaceId] as const,
  details: () => [...fieldGroupKeys.all, 'detail'] as const,
  detail: (workspaceId: string, fieldGroupId: string) =>
    [...fieldGroupKeys.details(), workspaceId, fieldGroupId] as const
};

export const invalidateDeletedFieldGroup = async (
  queryClient: QueryClient,
  workspaceId: string,
  fieldGroupId: string
) => {
  await queryClient.invalidateQueries({ queryKey: fieldGroupKeys.list(workspaceId) });
  queryClient.removeQueries({ queryKey: fieldGroupKeys.detail(workspaceId, fieldGroupId) });
};
