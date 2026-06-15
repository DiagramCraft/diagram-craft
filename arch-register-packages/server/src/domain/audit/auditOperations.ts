import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { buildApiAuthCtx, requireWorkspaceCapability } from '../auth/authorization';
import { resolveWorkspace } from '../workspace/resolveWorkspace';
import { toApiAuditLogEntry, filterAndPaginateAuditLogs, computeAuditStats } from './auditHelpers';
import { AuditLogEntry, AuditStats } from '@arch-register/api-types/auditContract';

const resolveAuditPublicIds = async (
  db: DatabaseAdapter,
  workspace: string,
  entry: AuditLogEntry
): Promise<AuditLogEntry> => {
  if (entry.entity_type === 'entity') {
    const entity = await db.catalog.getEntity(workspace, entry.entity_id);
    return {
      ...entry,
      public_id: entity?.public_id ?? null
    };
  }

  if (entry.entity_type === 'project') {
    const project = await db.project.getProject(workspace, entry.entity_id);
    return {
      ...entry,
      public_id: project?.public_id ?? null
    };
  }

  if (entry.entity_type === 'content_node') {
    const projectId = typeof entry.metadata['project_id'] === 'string' ? entry.metadata['project_id'] : null;
    if (!projectId) return entry;
    const project = await db.project.getProject(workspace, projectId);
    return {
      ...entry,
      metadata: {
        ...entry.metadata,
        project_public_id: project?.public_id ?? null
      }
    };
  }

  return entry;
};

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
  const entries = filterAndPaginateAuditLogs(rows, {
    entityType: filters.entityType ?? null,
    entityId: filters.entityId ?? null,
    operation: filters.operation ?? null,
    startDate: filters.startDate ?? null,
    endDate: filters.endDate ?? null,
    limit: filters.limit ?? 50,
    offset: filters.offset ?? 0
  }).map(entry => toApiAuditLogEntry(entry));

  return await Promise.all(entries.map(entry => resolveAuditPublicIds(db, ws, entry)));
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
