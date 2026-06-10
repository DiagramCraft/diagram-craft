import { defineHandler } from 'h3';
import { implement } from '@orpc/server';
import { OpenAPIHandler } from '@orpc/openapi/fetch';
import type { DatabaseAdapter } from '../../db/database';
import { buildApiAuthCtx, requireWorkspaceCapability } from '../auth/authorization';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { resolveWorkspace } from '../workspace/resolveWorkspace';
import { toORPCError, orpcErrorInterceptors } from '../../utils/orpcErrors';
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

const schemaRouter = implement(workspaceSchemaContract).$context<ORPCContext>();

export const workspaceSchemaORPCRouter = schemaRouter.router({
  schemas: {
    list: schemaRouter.schemas.list.handler(async ({ input, context }) => {
      try {
        const workspace = await resolveWorkspace(context.db.catalog, input.workspace);
        const authCtx = await buildApiAuthCtx(context.db, workspace, context.event);
        requireWorkspaceCapability(authCtx, 'ws.view');
        return await listWorkspaceSchemas(context.db, workspace);
      } catch (error) {
        return toORPCError(error);
      }
    }),
    get: schemaRouter.schemas.get.handler(async ({ input, context }) => {
      try {
        const workspace = await resolveWorkspace(context.db.catalog, input.workspace);
        const authCtx = await buildApiAuthCtx(context.db, workspace, context.event);
        requireWorkspaceCapability(authCtx, 'ws.view');
        return await getWorkspaceSchema(context.db, workspace, input.id);
      } catch (error) {
        return toORPCError(error);
      }
    }),
    create: schemaRouter.schemas.create.handler(async ({ input, context }) => {
      try {
        const workspace = await resolveWorkspace(context.db.catalog, input.workspace);
        const authCtx = await buildApiAuthCtx(context.db, workspace, context.event);
        requireWorkspaceCapability(authCtx, 'schema.edit');
        return await createWorkspaceSchema(context.db, workspace, input, authCtx.userId);
      } catch (error) {
        return toORPCError(error);
      }
    }),
    update: schemaRouter.schemas.update.handler(async ({ input, context }) => {
      try {
        const workspace = await resolveWorkspace(context.db.catalog, input.workspace);
        const authCtx = await buildApiAuthCtx(context.db, workspace, context.event);
        requireWorkspaceCapability(authCtx, 'schema.edit');
        return await updateWorkspaceSchema(context.db, workspace, input.id, input, authCtx.userId);
      } catch (error) {
        return toORPCError(error);
      }
    }),
    remove: schemaRouter.schemas.remove.handler(async ({ input, context }) => {
      try {
        const workspace = await resolveWorkspace(context.db.catalog, input.workspace);
        const authCtx = await buildApiAuthCtx(context.db, workspace, context.event);
        requireWorkspaceCapability(authCtx, 'schema.edit');
        return await deleteWorkspaceSchema(context.db, workspace, input.id, authCtx.userId);
      } catch (error) {
        return toORPCError(error);
      }
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
