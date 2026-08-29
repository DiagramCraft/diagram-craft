import { queryOptions, type QueryClient } from '@tanstack/react-query';
import { orpcClient } from '../lib/orpcClient';

export const categoryKeys = {
  all: ['categories'] as const,
  lists: () => [...categoryKeys.all, 'list'] as const,
  list: (workspaceId: string) => [...categoryKeys.lists(), workspaceId] as const
};

export const categoriesQuery = (workspaceId: string, enabled = true) =>
  queryOptions({
    queryKey: categoryKeys.list(workspaceId),
    queryFn: () => orpcClient.categories.list({ params: { workspace: workspaceId } }),
    enabled: enabled && !!workspaceId,
    staleTime: 5 * 60 * 1000
  });

export const invalidateCategoryQueries = async (queryClient: QueryClient, workspaceId: string) => {
  await queryClient.invalidateQueries({ queryKey: categoryKeys.list(workspaceId) });
};
