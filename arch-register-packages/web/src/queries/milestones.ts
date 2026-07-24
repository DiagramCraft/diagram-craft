export const milestoneKeys = {
  all: ['milestones'] as const,
  lists: () => [...milestoneKeys.all, 'list'] as const,
  list: (workspaceId: string, projectId: string) =>
    [...milestoneKeys.lists(), workspaceId, projectId] as const,
  details: () => [...milestoneKeys.all, 'detail'] as const,
  detail: (workspaceId: string, projectId: string, milestoneId: string) =>
    [...milestoneKeys.details(), workspaceId, projectId, milestoneId] as const
};
