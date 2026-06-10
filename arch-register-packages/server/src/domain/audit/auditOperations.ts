import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { buildApiAuthCtx, requireWorkspaceCapability } from '../auth/authorization';
import { resolveWorkspace } from '../workspace/resolveWorkspace';
import { toApiAuditLogEntry, filterAndPaginateAuditLogs, computeAuditStats } from './auditHelpers';
import { AuditLogEntry, AuditStats } from '@arch-register/api-types/audit';

export const listAuditLog = async (
  db: DatabaseAdapter,
  workspace: string,
  filters: {
    entityType?: string;
    entityId?: string;
    operation?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  },
  event: AuthenticatedEvent
): Promise<AuditLogEntry[]> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  const authCtx = await buildApiAuthCtx(db, ws, event);
  requireWorkspaceCapability(authCtx, 'ws.audit');

  const rows = await db.audit.listAuditLogs(ws);
  return filterAndPaginateAuditLogs(rows, {
    entityType: filters.entityType ?? null,
    entityId: filters.entityId ?? null,
    operation: filters.operation ?? null,
    startDate: filters.startDate ?? null,
    endDate: filters.endDate ?? null,
    limit: filters.limit ?? 50,
    offset: filters.offset ?? 0
  }).map(toApiAuditLogEntry);
};

export const getAuditStats = async (
  db: DatabaseAdapter,
  workspace: string,
  event: AuthenticatedEvent
): Promise<AuditStats> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  const authCtx = await buildApiAuthCtx(db, ws, event);
  requireWorkspaceCapability(authCtx, 'ws.audit');

  const rows = await db.audit.listAuditLogs(ws);
  return computeAuditStats(rows);
};
