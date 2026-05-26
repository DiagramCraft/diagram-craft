import { H3, H3Event, HTTPError, defineHandler, getQuery } from 'h3';
import sql from '../db/client.js';
import type { AuditLogEntry, AuditLogApiResponse } from '../types.js';

const BASE = '/api/:workspace/audit';

const getWorkspace = (event: H3Event) => {
  const workspace = event.context.params?.['workspace'];
  if (!workspace) throw new HTTPError({ status: 400, statusText: 'Bad Request', message: 'workspace is required' });
  return workspace;
};

const parsePositiveInt = (value: unknown, field: string) => {
  if (value == null || value === '') return null;
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new HTTPError({
      status: 400,
      statusText: 'Bad Request',
      message: `${field} must be a non-negative integer`
    });
  }
  return parsed;
};

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
  metadata: row.metadata,
});

export const createAuditRoutes = () => {
  const router = new H3();

  // GET /api/:workspace/audit
  // Query params: entityType, entityId, operation, startDate, endDate, limit, offset
  router.get(
    BASE,
    defineHandler(async event => {
      const workspace = getWorkspace(event);
      const query = getQuery(event);
      
      const entityType = typeof query['entityType'] === 'string' ? query['entityType'] : null;
      const entityId = typeof query['entityId'] === 'string' ? query['entityId'] : null;
      const operation = typeof query['operation'] === 'string' ? query['operation'] : null;
      const startDate = typeof query['startDate'] === 'string' ? query['startDate'] : null;
      const endDate = typeof query['endDate'] === 'string' ? query['endDate'] : null;
      const limit = parsePositiveInt(query['limit'], 'limit') ?? 50;
      const offset = parsePositiveInt(query['offset'], 'offset') ?? 0;

      try {
        const rows = await sql<AuditLogEntry[]>`
          SELECT *
          FROM audit_log
          WHERE workspace = ${workspace}
            ${entityType ? sql`AND entity_type = ${entityType}` : sql``}
            ${entityId ? sql`AND entity_id = ${entityId}` : sql``}
            ${operation ? sql`AND operation = ${operation}` : sql``}
            ${startDate ? sql`AND timestamp >= ${startDate}::timestamptz` : sql``}
            ${endDate ? sql`AND timestamp <= ${endDate}::timestamptz` : sql``}
          ORDER BY timestamp DESC
          LIMIT ${limit}
          OFFSET ${offset}
        `;

        return rows.map(toApiFormat);
      } catch (e) {
        throw new HTTPError({ status: 500, statusText: 'Internal Server Error', message: 'Failed to retrieve audit log' });
      }
    })
  );

  // GET /api/:workspace/audit/stats
  // Returns summary statistics about audit log entries
  router.get(
    `${BASE}/stats`,
    defineHandler(async event => {
      const workspace = getWorkspace(event);

      try {
        const [totalRow] = await sql<{ count: number }[]>`
          SELECT COUNT(*)::int AS count
          FROM audit_log
          WHERE workspace = ${workspace}
        `;

        const byOperation = await sql<{ operation: string; count: number }[]>`
          SELECT operation, COUNT(*)::int AS count
          FROM audit_log
          WHERE workspace = ${workspace}
          GROUP BY operation
          ORDER BY count DESC
        `;

        const byEntityType = await sql<{ entity_type: string; count: number }[]>`
          SELECT entity_type, COUNT(*)::int AS count
          FROM audit_log
          WHERE workspace = ${workspace}
          GROUP BY entity_type
          ORDER BY count DESC
        `;

        const recentActivity = await sql<{ date: string; count: number }[]>`
          SELECT DATE(timestamp) AS date, COUNT(*)::int AS count
          FROM audit_log
          WHERE workspace = ${workspace}
            AND timestamp >= NOW() - INTERVAL '30 days'
          GROUP BY DATE(timestamp)
          ORDER BY date DESC
        `;

        return {
          total: totalRow?.count ?? 0,
          byOperation,
          byEntityType,
          recentActivity,
        };
      } catch (e) {
        throw new HTTPError({ status: 500, statusText: 'Internal Server Error', message: 'Failed to retrieve audit stats' });
      }
    })
  );

  return router;
};
