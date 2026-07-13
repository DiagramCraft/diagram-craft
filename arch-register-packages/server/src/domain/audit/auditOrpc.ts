import { defineHandler } from 'h3';
import { implement } from '@orpc/server';
import { OpenAPIHandler } from '@orpc/openapi/fetch';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { orpcErrorInterceptors, orpcErrorMiddleware } from '../../utils/orpcErrors';
import { listAuditLog, getAuditStats } from './auditOperations';
import { auditContract } from '@arch-register/api-types/auditContract';

type ORPCContext = {
  db: DatabaseAdapter;
  event: AuthenticatedEvent;
};

const auditRouter = implement(auditContract).$context<ORPCContext>().use(orpcErrorMiddleware);

export const auditORPCRouter = auditRouter.router({
  audit: {
    list: auditRouter.audit.list.handler(async ({ input, context }) => {
      return await listAuditLog(context.db, input.params.workspace, input.query, context.event);
    }),
    stats: auditRouter.audit.stats.handler(async ({ input, context }) => {
      return await getAuditStats(context.db, input.params.workspace, context.event);
    })
  }
});

export const auditOpenAPIHandler = new OpenAPIHandler(auditORPCRouter, {
  clientInterceptors: orpcErrorInterceptors
});

export const createAuditORPCHandler = (db: DatabaseAdapter) =>
  defineHandler(async event => {
    const result = await auditOpenAPIHandler.handle(event.req, {
      prefix: '/api',
      context: {
        db,
        event: event as AuthenticatedEvent
      }
    });

    if (result.matched) {
      return result.response;
    }
  });
