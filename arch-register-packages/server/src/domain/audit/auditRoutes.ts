import { H3, defineHandler, getQuery } from 'h3';
import type { DatabaseAdapter } from '../../db/database';
import { resolveWorkspace } from '../workspace/resolveWorkspace';
import { parsePositiveInt } from '../../utils/http';
import { buildApiAuthCtx, requireWorkspaceCapability } from '../auth/authorization';
import type { AuthenticatedEvent } from '../../middleware/auth';
import {
  toApiAuditLogEntry,
  filterAndPaginateAuditLogs,
  computeAuditStats
} from './auditHelpers';

const BASE = '/api/:workspace/audit';

export const buildAuditListFilters = (query: Record<string, unknown>) => ({
  entityType: typeof query['entityType'] === 'string' ? query['entityType'] : null,
  entityId: typeof query['entityId'] === 'string' ? query['entityId'] : null,
  operation: typeof query['operation'] === 'string' ? query['operation'] : null,
  startDate: typeof query['startDate'] === 'string' ? query['startDate'] : null,
  endDate: typeof query['endDate'] === 'string' ? query['endDate'] : null,
  limit: parsePositiveInt(query['limit'], 'limit') ?? 50,
  offset: parsePositiveInt(query['offset'], 'offset') ?? 0
});

export const createAuditRoutes = (db: DatabaseAdapter) => {
  const router = new H3();

  router.get(
    BASE,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);

      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      requireWorkspaceCapability(authCtx, 'ws.audit');

      const query = getQuery(event);

      const filters = buildAuditListFilters(query);

      const rows = await db.audit.listAuditLogs(workspace);
      return filterAndPaginateAuditLogs(rows, filters).map(toApiAuditLogEntry);
    })
  );

  router.get(
    `${BASE}/stats`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      requireWorkspaceCapability(authCtx, 'ws.audit');

      const rows = await db.audit.listAuditLogs(workspace);
      return computeAuditStats(rows);
    })
  );

  return router;
};
