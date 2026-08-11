import { queryOptions, type QueryClient } from '@tanstack/react-query';
import { orpcClient } from '../lib/orpcClient';
import { workspaceAnalyticsKeys } from './workspaceAnalytics';

export const auditKeys = {
  all: ['audit'] as const,
  logs: () => [...auditKeys.all, 'log'] as const,
  workspaceLogs: (workspaceId: string) => [...auditKeys.logs(), workspaceId] as const,
  log: (workspaceId: string, options: Record<string, unknown>) =>
    [...auditKeys.workspaceLogs(workspaceId), options] as const,
  stats: (workspaceId: string) => [...auditKeys.all, 'stats', workspaceId] as const
};

export type AuditLogOptions = {
  entityType?: string | null;
  entityId?: string | null;
  schemaId?: string | null;
  owner?: string | null;
  lifecycle?: string | null;
  operation?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  limit?: number | null;
  offset?: number | null;
};

export const auditLogQuery = (workspaceId: string, options: AuditLogOptions = {}, enabled = true) =>
  queryOptions({
    queryKey: auditKeys.log(workspaceId, options),
    queryFn: () =>
      orpcClient.audit.list({
        params: { workspace: workspaceId },
        query: {
          entityType: options.entityType ?? undefined,
          entityId: options.entityId ?? undefined,
          schemaId: options.schemaId ?? undefined,
          owner: options.owner ?? undefined,
          lifecycle: options.lifecycle ?? undefined,
          operation: options.operation ?? undefined,
          startDate: options.startDate ?? undefined,
          endDate: options.endDate ?? undefined,
          limit: options.limit ?? undefined,
          offset: options.offset ?? undefined
        }
      }),
    enabled: enabled && !!workspaceId
  });

export const auditStatsQuery = (workspaceId: string) =>
  queryOptions({
    queryKey: auditKeys.stats(workspaceId),
    queryFn: () => orpcClient.audit.stats({ params: { workspace: workspaceId } }),
    enabled: !!workspaceId,
    staleTime: 5 * 60 * 1000
  });

export const invalidateAuditQueries = async (queryClient: QueryClient, workspaceId: string) => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: auditKeys.workspaceLogs(workspaceId) }),
    queryClient.invalidateQueries({ queryKey: auditKeys.stats(workspaceId) }),
    queryClient.invalidateQueries({ queryKey: workspaceAnalyticsKeys.workspace(workspaceId) })
  ]);
};
