import type { QueryClient } from '@tanstack/react-query';
import { workspaceAnalyticsKeys } from './workspaceAnalytics';

export const auditKeys = {
  all: ['audit'] as const,
  logs: () => [...auditKeys.all, 'log'] as const,
  workspaceLogs: (workspaceId: string) => [...auditKeys.logs(), workspaceId] as const,
  log: (workspaceId: string, options: Record<string, unknown>) =>
    [...auditKeys.workspaceLogs(workspaceId), options] as const,
  stats: (workspaceId: string) => [...auditKeys.all, 'stats', workspaceId] as const
};

export const invalidateAuditQueries = async (queryClient: QueryClient, workspaceId: string) => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: auditKeys.workspaceLogs(workspaceId) }),
    queryClient.invalidateQueries({ queryKey: auditKeys.stats(workspaceId) }),
    queryClient.invalidateQueries({ queryKey: workspaceAnalyticsKeys.workspace(workspaceId) })
  ]);
};
