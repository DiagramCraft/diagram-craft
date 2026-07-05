import { defineHandler } from 'h3';
import { implement } from '@orpc/server';
import { OpenAPIHandler } from '@orpc/openapi/fetch';
import type { DatabaseAdapter } from '../../db/database';
import {
  buildApiAuthCtx,
  requireSchemaRead,
  requireWorkspaceCapability
} from '../auth/authorization';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { resolveWorkspace } from '../workspace/resolveWorkspace';
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
      const workspace = await resolveWorkspace(context.db.catalog, input.params.workspace);
      const authCtx = await buildApiAuthCtx(context.db, workspace, context.event);
      requireSchemaRead(authCtx);
      return await listWorkspaceSchemas(context.db, workspace);
    }),
    get: schemaRouter.schemas.get.handler(async ({ input, context }) => {
      const workspace = await resolveWorkspace(context.db.catalog, input.params.workspace);
      const authCtx = await buildApiAuthCtx(context.db, workspace, context.event);
      requireSchemaRead(authCtx);
      return await getWorkspaceSchema(context.db, workspace, input.params.id);
    }),
    create: schemaRouter.schemas.create.handler(async ({ input, context }) => {
      const workspace = await resolveWorkspace(context.db.catalog, input.params.workspace);
      const authCtx = await buildApiAuthCtx(context.db, workspace, context.event);
      requireWorkspaceCapability(authCtx, 'schema.edit');
      return await createWorkspaceSchema(context.db, workspace, input.body, authCtx.userId);
    }),
    update: schemaRouter.schemas.update.handler(async ({ input, context }) => {
      const workspace = await resolveWorkspace(context.db.catalog, input.params.workspace);
      const authCtx = await buildApiAuthCtx(context.db, workspace, context.event);
      requireWorkspaceCapability(authCtx, 'schema.edit');
      return await updateWorkspaceSchema(
        context.db,
        workspace,
        input.params.id,
        input.body,
        authCtx.userId
      );
    }),
    remove: schemaRouter.schemas.remove.handler(async ({ input, context }) => {
      const workspace = await resolveWorkspace(context.db.catalog, input.params.workspace);
      const authCtx = await buildApiAuthCtx(context.db, workspace, context.event);
      requireWorkspaceCapability(authCtx, 'schema.edit');
      return await deleteWorkspaceSchema(context.db, workspace, input.params.id, authCtx.userId);
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
