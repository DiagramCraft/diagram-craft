import { H3, defineHandler, getQuery } from 'h3';
import type { DatabaseAdapter } from '../db/database.js';
import { resolveWorkspace } from './workspace-resolver.js';
import { parsePositiveInt } from '../utils/http.js';
import { buildApiAuthCtx, requireWorkspaceCapability } from '../auth/authorization.js';
import type { AuthenticatedEvent } from '../middleware/auth.js';
import { toApiAuditLogEntry } from '../api/transforms.js';

const BASE = '/api/:workspace/audit';

export const createAuditRoutes = (db: DatabaseAdapter) => {
  const router = new H3();

  router.get(
    BASE,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(event, db);

      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      requireWorkspaceCapability(authCtx, 'ws.audit');

      const query = getQuery(event);

      const entityType = typeof query['entityType'] === 'string' ? query['entityType'] : null;
      const entityId = typeof query['entityId'] === 'string' ? query['entityId'] : null;
      const operation = typeof query['operation'] === 'string' ? query['operation'] : null;
      const startDate = typeof query['startDate'] === 'string' ? query['startDate'] : null;
      const endDate = typeof query['endDate'] === 'string' ? query['endDate'] : null;
      const limit = parsePositiveInt(query['limit'], 'limit') ?? 50;
      const offset = parsePositiveInt(query['offset'], 'offset') ?? 0;

      let rows = await db.audit.listAuditLogs(workspace);
      if (entityType) rows = rows.filter(row => row.entity_type === entityType);
      if (entityId) rows = rows.filter(row => row.entity_id === entityId);
      if (operation) rows = rows.filter(row => row.operation === operation);
      if (startDate) rows = rows.filter(row => row.timestamp >= new Date(startDate));
      if (endDate) rows = rows.filter(row => row.timestamp <= new Date(endDate));

      return rows.slice(offset, offset + limit).map(toApiAuditLogEntry);
    })
  );

  router.get(
    `${BASE}/stats`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(event, db);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      requireWorkspaceCapability(authCtx, 'ws.audit');

      const rows = await db.audit.listAuditLogs(workspace);
      const byOperationMap = new Map<string, number>();
      const byEntityTypeMap = new Map<string, number>();
      const recentActivityMap = new Map<string, number>();
      const threshold = Date.now() - 30 * 24 * 60 * 60 * 1000;

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
    })
  );

  return router;
};