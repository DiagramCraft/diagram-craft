export const milestoneKeys = {
  all: ['milestones'] as const,
  lists: () => [...milestoneKeys.all, 'list'] as const,
  list: (workspaceId: string, projectId?: string) =>
    [...milestoneKeys.lists(), workspaceId, projectId ?? 'all'] as const,
  details: () => [...milestoneKeys.all, 'detail'] as const,
  detail: (workspaceId: string, milestoneId: string) =>
    [...milestoneKeys.details(), workspaceId, milestoneId] as const
};
