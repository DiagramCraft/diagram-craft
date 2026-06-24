import { useQuery } from '@tanstack/react-query';
import { auditKeys } from './queryKeys';
import { orpcClient } from '../lib/orpcClient';

// Hook for fetching audit log
export const useAuditLog = (
  workspaceId: string,
  options: {
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
