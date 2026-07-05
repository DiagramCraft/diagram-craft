import { defineHandler } from 'h3';
import { implement } from '@orpc/server';
import { OpenAPIHandler } from '@orpc/openapi/fetch';
import type { DatabaseAdapter } from '../../db/database';
import { buildApiAuthCtx, requireWorkspaceCapability } from '../auth/authorization';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { resolveWorkspace } from '../workspace/resolveWorkspace';
import { orpcErrorInterceptors, orpcErrorMiddleware } from '../../utils/orpcErrors';
import {
  createWorkspaceEnum,
  deleteWorkspaceEnum,
  getWorkspaceEnum,
  listWorkspaceEnums,
  updateWorkspaceEnum
} from './enumOperations';
import { workspaceEnumContract } from '@arch-register/api-types/enumContract';

type ORPCContext = {
  db: DatabaseAdapter;
  event: AuthenticatedEvent;
};

const enumRouter = implement(workspaceEnumContract)
  .$context<ORPCContext>()
  .use(orpcErrorMiddleware);

export const workspaceEnumORPCRouter = enumRouter.router({
  enums: {
    list: enumRouter.enums.list.handler(async ({ input, context }) => {
      const workspace = await resolveWorkspace(context.db.catalog, input.params.workspace);
      const authCtx = await buildApiAuthCtx(context.db, workspace, context.event);
      requireWorkspaceCapability(authCtx, 'ws.view');
      return await listWorkspaceEnums(context.db, workspace);
    }),
    get: enumRouter.enums.get.handler(async ({ input, context }) => {
      const workspace = await resolveWorkspace(context.db.catalog, input.params.workspace);
      const authCtx = await buildApiAuthCtx(context.db, workspace, context.event);
      requireWorkspaceCapability(authCtx, 'ws.view');
      return await getWorkspaceEnum(context.db, workspace, input.params.id);
    }),
    create: enumRouter.enums.create.handler(async ({ input, context }) => {
      const workspace = await resolveWorkspace(context.db.catalog, input.params.workspace);
      const authCtx = await buildApiAuthCtx(context.db, workspace, context.event);
      requireWorkspaceCapability(authCtx, 'schema.edit');
      return await createWorkspaceEnum(context.db, workspace, input.body);
    }),
    update: enumRouter.enums.update.handler(async ({ input, context }) => {
      const workspace = await resolveWorkspace(context.db.catalog, input.params.workspace);
      const authCtx = await buildApiAuthCtx(context.db, workspace, context.event);
      requireWorkspaceCapability(authCtx, 'schema.edit');
      return await updateWorkspaceEnum(context.db, workspace, input.params.id, input.body);
    }),
    remove: enumRouter.enums.remove.handler(async ({ input, context }) => {
      const workspace = await resolveWorkspace(context.db.catalog, input.params.workspace);
      const authCtx = await buildApiAuthCtx(context.db, workspace, context.event);
      requireWorkspaceCapability(authCtx, 'schema.edit');
      return await deleteWorkspaceEnum(context.db, workspace, input.params.id);
    })
  }
});

export const workspaceEnumOpenAPIHandler = new OpenAPIHandler(workspaceEnumORPCRouter, {
  clientInterceptors: orpcErrorInterceptors
});

export const createWorkspaceEnumORPCHandler = (db: DatabaseAdapter) =>
  defineHandler(async event => {
    const result = await workspaceEnumOpenAPIHandler.handle(event.req, {
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
