import { defineHandler } from 'h3';
import { implement } from '@orpc/server';
import { OpenAPIHandler } from '@orpc/openapi/fetch';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { orpcErrorInterceptors, orpcErrorMiddleware } from '../../utils/orpcErrors';
import {
  listWorkspaceSchemas,
  getWorkspaceSchema,
  createWorkspaceSchema,
  updateWorkspaceSchema,
  deleteWorkspaceSchema
} from './schemaOperations';
import { workspaceSchemaContract } from '@arch-register/api-types/schemaContract';

type ORPCContext = {
  db: DatabaseAdapter;
  event: AuthenticatedEvent;
};

const schemaRouter = implement(workspaceSchemaContract)
  .$context<ORPCContext>()
  .use(orpcErrorMiddleware);

export const workspaceSchemaORPCRouter = schemaRouter.router({
  schemas: {
    list: schemaRouter.schemas.list.handler(async ({ input, context }) => {
      return await listWorkspaceSchemas(context.db, input.params.workspace, context.event);
    }),
    get: schemaRouter.schemas.get.handler(async ({ input, context }) => {
      return await getWorkspaceSchema(
        context.db,
        input.params.workspace,
        input.params.id,
        context.event
      );
    }),
    create: schemaRouter.schemas.create.handler(async ({ input, context }) => {
      return await createWorkspaceSchema(
        context.db,
        input.params.workspace,
        input.body,
        context.event
      );
    }),
    update: schemaRouter.schemas.update.handler(async ({ input, context }) => {
      return await updateWorkspaceSchema(
        context.db,
        input.params.workspace,
        input.params.id,
        input.body,
        context.event
      );
    }),
    remove: schemaRouter.schemas.remove.handler(async ({ input, context }) => {
      return await deleteWorkspaceSchema(
        context.db,
        input.params.workspace,
        input.params.id,
        context.event
      );
    })
  }
});

export const workspaceSchemaOpenAPIHandler = new OpenAPIHandler(workspaceSchemaORPCRouter, {
  clientInterceptors: orpcErrorInterceptors
});

export const createWorkspaceSchemaORPCHandler = (db: DatabaseAdapter) =>
  defineHandler(async event => {
    const result = await workspaceSchemaOpenAPIHandler.handle(event.req, {
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
