import type { AuditLogEntryRow as InternalAuditLogEntry } from './db/auditDatabase';
import type { AuditLogEntry, AuditStats } from '@arch-register/api-types';

export type AuditListFilters = {
  entityType: string | null;
  entityId: string | null;
  operation: string | null;
  startDate: string | null;
  endDate: string | null;
  limit: number;
  offset: number;
};

export const filterAndPaginateAuditLogs = (
  rows: InternalAuditLogEntry[],
  filters: AuditListFilters
): InternalAuditLogEntry[] => {
  let result = rows;
  if (filters.entityType) result = result.filter(row => row.entity_type === filters.entityType);
  if (filters.entityId) result = result.filter(row => row.entity_id === filters.entityId);
  if (filters.operation) result = result.filter(row => row.operation === filters.operation);
  if (filters.startDate)
    result = result.filter(row => row.timestamp >= new Date(filters.startDate!));
  if (filters.endDate) result = result.filter(row => row.timestamp <= new Date(filters.endDate!));
  return result.slice(filters.offset, filters.offset + filters.limit);
};

export const computeAuditStats = (
  rows: InternalAuditLogEntry[],
  nowMs = Date.now()
): AuditStats => {
  const byOperationMap = new Map<string, number>();
  const byEntityTypeMap = new Map<string, number>();
  const recentActivityMap = new Map<string, number>();
  const threshold = nowMs - 30 * 24 * 60 * 60 * 1000;

  for (const row of rows) {
    byOperationMap.set(row.operation, (byOperationMap.get(row.operation) ?? 0) + 1);
    byEntityTypeMap.set(row.entity_type, (byEntityTypeMap.get(row.entity_type) ?? 0) + 1);
    if (row.timestamp.getTime() >= threshold) {
      const key = row.timestamp.toISOString().slice(0, 10);
      recentActivityMap.set(key, (recentActivityMap.get(key) ?? 0) + 1);
    }
  }

  return {
    total: rows.length,
    byOperation: [...byOperationMap.entries()]
      .map(([operation, count]) => ({ operation, count }))
      .sort((a, b) => b.count - a.count),
    byEntityType: [...byEntityTypeMap.entries()]
      .map(([entity_type, count]) => ({ entity_type, count }))
      .sort((a, b) => b.count - a.count),
    recentActivity: [...recentActivityMap.entries()]
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => b.date.localeCompare(a.date))
  };
};

export const toApiAuditLogEntry = (entry: InternalAuditLogEntry): AuditLogEntry => ({
  id: entry.id,
  workspace: entry.workspace,
  timestamp: entry.timestamp.toISOString(),
  user_id: entry.user_id,
  operation: entry.operation,
  entity_type: entry.entity_type,
  entity_id: entry.entity_id,
  entity_name: entry.entity_name,
  entity_slug: entry.entity_slug,
  schema_id: entry.schema_id,
  changes: entry.changes,
  metadata: entry.metadata
});
