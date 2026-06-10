import { useQuery, type QueryClient } from '@tanstack/react-query';
import { orpcClient } from '../lib/orpcClient';

// Query keys factory
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
    queryClient.invalidateQueries({ queryKey: auditKeys.stats(workspaceId) })
  ]);
};

// Hook for fetching audit log
export const useAuditLog = (
  workspaceId: string,
  options: {
    entityType?: string | null;
    entityId?: string | null;
    operation?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    limit?: number | null;
    offset?: number | null;
  } = {},
  queryOptions?: { enabled?: boolean }
) => {
  return useQuery({
    queryKey: auditKeys.log(workspaceId, options),
    queryFn: () =>
      orpcClient.audit.list({
        params: { workspace: workspaceId },
        query: {
          entityType: options.entityType ?? undefined,
          entityId: options.entityId ?? undefined,
          operation: options.operation ?? undefined,
          startDate: options.startDate ?? undefined,
          endDate: options.endDate ?? undefined,
          limit: options.limit ?? undefined,
          offset: options.offset ?? undefined
        }
      }),
    enabled: queryOptions?.enabled ?? !!workspaceId
  });
};

// Hook for fetching audit stats
export const useAuditStats = (workspaceId: string) => {
  return useQuery({
    queryKey: auditKeys.stats(workspaceId),
    queryFn: () => orpcClient.audit.stats({ params: { workspace: workspaceId } }),
    enabled: !!workspaceId,
    staleTime: 5 * 60 * 1000 // 5 minutes
  });
};
