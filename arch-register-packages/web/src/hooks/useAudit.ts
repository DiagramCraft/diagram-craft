import { useQuery } from '@tanstack/react-query';
import { auditLogQuery, auditStatsQuery, type AuditLogOptions } from '../queries/audit';

// Hook for fetching audit log
export const useAuditLog = (
  workspaceId: string,
  options: AuditLogOptions = {},
  queryOptions?: { enabled?: boolean }
) => {
  return useQuery(auditLogQuery(workspaceId, options, queryOptions?.enabled ?? true));
};

// Hook for fetching audit stats
export const useAuditStats = (workspaceId: string) => {
  return useQuery(auditStatsQuery(workspaceId));
};
