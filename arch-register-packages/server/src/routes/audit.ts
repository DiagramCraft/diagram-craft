import { H3, HTTPError, defineHandler, getQuery } from 'h3';
import type { DatabaseAdapter } from '../db/database.js';
import type { AuditLogEntry, AuditLogApiResponse } from '../types.js';
import { resolveWorkspace } from './workspace-resolver.js';
import { parsePositiveInt } from '../utils/http.js';
import { buildApiAuthCtx, requireGlobalPermission } from '../auth/authorization.js';
import type { AuthenticatedEvent } from '../middleware/auth.js';

const BASE = '/api/:workspace/audit';

const toApiFormat = (row: AuditLogEntry): AuditLogApiResponse => ({
  id: row.id,
  workspace: row.workspace,
  timestamp: row.timestamp.toISOString(),
  user_id: row.user_id,
  operation: row.operation,
  entity_type: row.entity_type,
  entity_id: row.entity_id,
  entity_name: row.entity_name,
  entity_slug: row.entity_slug,
  schema_id: row.schema_id,
  changes: row.changes,
  metadata: row.metadata
});

export const createAuditRoutes = (db: DatabaseAdapter) => {
  const router = new H3();

  // GET /api/:workspace/audit
  // Query params: entityType, entityId, operation, startDate, endDate, limit, offset
  router.get(
    BASE,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(event, db);

      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      requireGlobalPermission(authCtx, 'view_audit');

      const query = getQuery(event);

      const entityType = typeof query['entityType'] === 'string' ? query['entityType'] : null;
      const entityId = typeof query['entityId'] === 'string' ? query['entityId'] : null;
      const operation = typeof query['operation'] === 'string' ? query['operation'] : null;
      const startDate = typeof query['startDate'] === 'string' ? query['startDate'] : null;
      const endDate = typeof query['endDate'] === 'string' ? query['endDate'] : null;
      const limit = parsePositiveInt(query['limit'], 'limit') ?? 50;
      const offset = parsePositiveInt(query['offset'], 'offset') ?? 0;

      try {
        let rows = await db.listAuditLogs(workspace);
        if (entityType) rows = rows.filter(row => row.entity_type === entityType);
        if (entityId) rows = rows.filter(row => row.entity_id === entityId);
        if (operation) rows = rows.filter(row => row.operation === operation);
        if (startDate) rows = rows.filter(row => row.timestamp >= new Date(startDate));
        if (endDate) rows = rows.filter(row => row.timestamp <= new Date(endDate));

        return rows.slice(offset, offset + limit).map(toApiFormat);
      } catch (_e) {
        throw new HTTPError({
          status: 500,
          statusText: 'Internal Server Error',
          message: 'Failed to retrieve audit log'
        });
      }
    })
  );

  // GET /api/:workspace/audit/stats
  // Returns summary statistics about audit log entries
  router.get(
    `${BASE}/stats`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(event, db);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      requireGlobalPermission(authCtx, 'view_audit');

      try {
        const rows = await db.listAuditLogs(workspace);
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
      } catch (_e) {
        throw new HTTPError({
          status: 500,
          statusText: 'Internal Server Error',
          message: 'Failed to retrieve audit stats'
        });
      }
    })
  );

  return router;
};
