import type { QueryClient } from '@tanstack/react-query';

export const enumKeys = {
  all: ['enums'] as const,
  lists: () => [...enumKeys.all, 'list'] as const,
  workspaceLists: (workspaceId: string) => [...enumKeys.lists(), workspaceId] as const,
  list: (workspaceId: string) => enumKeys.workspaceLists(workspaceId),
  details: () => [...enumKeys.all, 'detail'] as const,
  detail: (workspaceId: string, enumId: string) =>
    [...enumKeys.details(), workspaceId, enumId] as const
};

export const invalidateDeletedEnum = async (
  queryClient: QueryClient,
  workspaceId: string,
  enumId: string
) => {
  await queryClient.invalidateQueries({ queryKey: enumKeys.list(workspaceId) });
  queryClient.removeQueries({ queryKey: enumKeys.detail(workspaceId, enumId) });
};
