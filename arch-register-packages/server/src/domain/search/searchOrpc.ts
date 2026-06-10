import { defineHandler } from 'h3';
import { implement } from '@orpc/server';
import { OpenAPIHandler } from '@orpc/openapi/fetch';
import { OpenAPIGenerator } from '@orpc/openapi';
import { ZodToJsonSchemaConverter } from '@orpc/zod/zod4';
import { searchContract } from '@arch-register/api-types';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { toORPCError } from '../../utils/orpcErrors';
import { searchWorkspace } from './searchOperations';

type ORPCContext = {
  db: DatabaseAdapter;
  event: AuthenticatedEvent;
};

const searchRouter = implement(searchContract).$context<ORPCContext>();

export const searchORPCRouter = searchRouter.router({
  search: {
    query: searchRouter.search.query.handler(async ({ input, context }) => {
      try {
        return await searchWorkspace(context.db, input.workspace, input, context.event);
      } catch (error) {
        return toORPCError(error);
      }
    })
  }
});

export const searchOpenAPIHandler = new OpenAPIHandler(searchORPCRouter);

let generatedSearchOpenAPISpec: Promise<object> | null = null;

export const getSearchOpenAPISpec = () => {
  generatedSearchOpenAPISpec ??= new OpenAPIGenerator({
    schemaConverters: [new ZodToJsonSchemaConverter()]
  }).generate(searchContract, {
    info: {
      title: 'Arch Register Search POC API',
      version: '1.0.0'
    },
    servers: [{ url: 'http://localhost:3010/api' }]
  });

  return generatedSearchOpenAPISpec;
};

export const createSearchOpenAPISpecHandler = () =>
  defineHandler(async () => Response.json(await getSearchOpenAPISpec()));

export const createSearchORPCHandler = (db: DatabaseAdapter) =>
  defineHandler(async event => {
    const result = await searchOpenAPIHandler.handle(event.req, {
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
