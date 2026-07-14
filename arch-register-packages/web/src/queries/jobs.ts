import type { QueryClient } from '@tanstack/react-query';

export const jobKeys = {
  all: ['jobs'] as const,
  servers: (workspaceId: string) => [...jobKeys.all, 'servers', workspaceId] as const,
  schedules: (workspaceId: string) => [...jobKeys.all, 'schedules', workspaceId] as const,
  runs: (workspaceId: string, filters: Record<string, unknown>) =>
    [...jobKeys.all, 'runs', workspaceId, filters] as const
};

export const invalidateJobQueries = async (queryClient: QueryClient, workspaceId: string) => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: jobKeys.servers(workspaceId) }),
    queryClient.invalidateQueries({ queryKey: jobKeys.schedules(workspaceId) }),
    queryClient.invalidateQueries({ queryKey: [...jobKeys.all, 'runs', workspaceId] })
  ]);
};
