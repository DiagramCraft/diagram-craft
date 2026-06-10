import { defineHandler } from 'h3';
import { implement } from '@orpc/server';
import { OpenAPIHandler } from '@orpc/openapi/fetch';
import { workspaceEnumContract } from '@arch-register/api-types';
import type { DatabaseAdapter } from '../../db/database';
import { buildApiAuthCtx, requireWorkspaceCapability } from '../auth/authorization';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { resolveWorkspace } from '../workspace/resolveWorkspace';
import { toORPCError } from '../../utils/orpcErrors';
import {
  createWorkspaceEnum,
  deleteWorkspaceEnum,
  getWorkspaceEnum,
  listWorkspaceEnums,
  updateWorkspaceEnum
} from './enumOperations';

type ORPCContext = {
  db: DatabaseAdapter;
  event: AuthenticatedEvent;
};

const enumRouter = implement(workspaceEnumContract).$context<ORPCContext>();

export const workspaceEnumORPCRouter = enumRouter.router({
  enums: {
    list: enumRouter.enums.list.handler(async ({ input, context }) => {
      try {
        const workspace = await resolveWorkspace(context.db.catalog, input.workspace);
        const authCtx = await buildApiAuthCtx(context.db, workspace, context.event);
        requireWorkspaceCapability(authCtx, 'ws.view');
        return await listWorkspaceEnums(context.db, workspace);
      } catch (error) {
        return toORPCError(error);
      }
    }),
    get: enumRouter.enums.get.handler(async ({ input, context }) => {
      try {
        const workspace = await resolveWorkspace(context.db.catalog, input.workspace);
        const authCtx = await buildApiAuthCtx(context.db, workspace, context.event);
        requireWorkspaceCapability(authCtx, 'ws.view');
        return await getWorkspaceEnum(context.db, workspace, input.id);
      } catch (error) {
        return toORPCError(error);
      }
    }),
    create: enumRouter.enums.create.handler(async ({ input, context }) => {
      try {
        const workspace = await resolveWorkspace(context.db.catalog, input.workspace);
        const authCtx = await buildApiAuthCtx(context.db, workspace, context.event);
        requireWorkspaceCapability(authCtx, 'schema.edit');
        return await createWorkspaceEnum(context.db, workspace, input);
      } catch (error) {
        return toORPCError(error);
      }
    }),
    update: enumRouter.enums.update.handler(async ({ input, context }) => {
      try {
        const workspace = await resolveWorkspace(context.db.catalog, input.workspace);
        const authCtx = await buildApiAuthCtx(context.db, workspace, context.event);
        requireWorkspaceCapability(authCtx, 'schema.edit');
        return await updateWorkspaceEnum(context.db, workspace, input.id, input);
      } catch (error) {
        return toORPCError(error);
      }
    }),
    remove: enumRouter.enums.remove.handler(async ({ input, context }) => {
      try {
        const workspace = await resolveWorkspace(context.db.catalog, input.workspace);
        const authCtx = await buildApiAuthCtx(context.db, workspace, context.event);
        requireWorkspaceCapability(authCtx, 'schema.edit');
        return await deleteWorkspaceEnum(context.db, workspace, input.id);
      } catch (error) {
        return toORPCError(error);
      }
    })
  }
});

export const workspaceEnumOpenAPIHandler = new OpenAPIHandler(workspaceEnumORPCRouter);

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
