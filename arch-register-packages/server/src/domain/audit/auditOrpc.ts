import { defineHandler } from 'h3';
import { implement } from '@orpc/server';
import { OpenAPIHandler } from '@orpc/openapi/fetch';
import { OpenAPIGenerator } from '@orpc/openapi';
import { ZodToJsonSchemaConverter } from '@orpc/zod/zod4';
import { auditContract } from '@arch-register/api-types';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { toORPCError } from '../../utils/orpcErrors';
import { listAuditLog, getAuditStats } from './auditOperations';

type ORPCContext = {
  db: DatabaseAdapter;
  event: AuthenticatedEvent;
};

const auditRouter = implement(auditContract).$context<ORPCContext>();

export const auditORPCRouter = auditRouter.router({
  audit: {
    list: auditRouter.audit.list.handler(async ({ input, context }) => {
      try {
        return await listAuditLog(context.db, input.workspace, input, context.event);
      } catch (error) {
        return toORPCError(error);
      }
    }),
    stats: auditRouter.audit.stats.handler(async ({ input, context }) => {
      try {
        return await getAuditStats(context.db, input.workspace, context.event);
      } catch (error) {
        return toORPCError(error);
      }
    })
  }
});

export const auditOpenAPIHandler = new OpenAPIHandler(auditORPCRouter);

let generatedAuditOpenAPISpec: Promise<object> | null = null;

export const getAuditOpenAPISpec = () => {
  generatedAuditOpenAPISpec ??= new OpenAPIGenerator({
    schemaConverters: [new ZodToJsonSchemaConverter()]
  }).generate(auditContract, {
    info: {
      title: 'Arch Register Audit POC API',
      version: '1.0.0'
    },
    servers: [{ url: 'http://localhost:3010/api' }]
  });

  return generatedAuditOpenAPISpec;
};

export const createAuditOpenAPISpecHandler = () =>
  defineHandler(async () => Response.json(await getAuditOpenAPISpec()));

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
