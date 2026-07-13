export const workspaceAnalyticsKeys = {
  all: ['workspace-analytics'] as const,
  workspace: (workspaceId: string) => [...workspaceAnalyticsKeys.all, workspaceId] as const,
  detail: (workspaceId: string, staleAfterDays: number) =>
    [...workspaceAnalyticsKeys.workspace(workspaceId), staleAfterDays] as const
};
