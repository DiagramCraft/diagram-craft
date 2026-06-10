import { H3, defineHandler, getQuery } from 'h3';
import type { DatabaseAdapter } from '../../db/database';
import { parsePositiveInt } from '../../utils/http';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { listAuditLog, getAuditStats } from './auditOperations';

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
      const workspace = event.context.params?.['workspace'] ?? '';
      const query = getQuery(event);
      const filters = buildAuditListFilters(query);
      return await listAuditLog(
        db,
        workspace,
        {
          entityType: filters.entityType ?? undefined,
          entityId: filters.entityId ?? undefined,
          operation: filters.operation ?? undefined,
          startDate: filters.startDate ?? undefined,
          endDate: filters.endDate ?? undefined,
          limit: filters.limit,
          offset: filters.offset
        },
        event as AuthenticatedEvent
      );
    })
  );

  router.get(
    `${BASE}/stats`,
    defineHandler(async event => {
      const workspace = event.context.params?.['workspace'] ?? '';
      return await getAuditStats(db, workspace, event as AuthenticatedEvent);
    })
  );

  return router;
};
