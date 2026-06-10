import { defineHandler } from 'h3';
import { implement } from '@orpc/server';
import { OpenAPIHandler } from '@orpc/openapi/fetch';
import { workspaceViewContract } from '@arch-register/api-types';
import type { DatabaseAdapter } from '../../db/database';
import { buildApiAuthCtx, requireWorkspaceCapability } from '../auth/authorization';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { resolveWorkspace } from '../workspace/resolveWorkspace';
import { toORPCError, orpcErrorInterceptors } from '../../utils/orpcErrors';
import {
  createPinnedEntity,
  createSavedView,
  deletePinnedEntity,
  deleteSavedView,
  listPinnedEntities,
  listSavedViews,
  updateSavedView
} from './viewOperations';

type ORPCContext = {
  db: DatabaseAdapter;
  event: AuthenticatedEvent;
};

const viewRouter = implement(workspaceViewContract).$context<ORPCContext>();

export const workspaceViewORPCRouter = viewRouter.router({
  views: {
    list: viewRouter.views.list.handler(async ({ input, context }) => {
      try {
        const workspace = await resolveWorkspace(context.db.catalog, input.workspace);
        const authCtx = await buildApiAuthCtx(context.db, workspace, context.event);
        requireWorkspaceCapability(authCtx, 'ws.view');
        return await listSavedViews(context.db, workspace);
      } catch (error) {
        return toORPCError(error);
      }
    }),
    create: viewRouter.views.create.handler(async ({ input, context }) => {
      try {
        const workspace = await resolveWorkspace(context.db.catalog, input.workspace);
        const authCtx = await buildApiAuthCtx(context.db, workspace, context.event);
        requireWorkspaceCapability(authCtx, 'ws.manage_views');
        return await createSavedView(context.db, workspace, {
          name: input.name,
          description: input.description,
          viewMode: input.viewMode,
          filters: input.filters,
          config: input.config
        });
      } catch (error) {
        return toORPCError(error);
      }
    }),
    update: viewRouter.views.update.handler(async ({ input, context }) => {
      try {
        const workspace = await resolveWorkspace(context.db.catalog, input.workspace);
        const authCtx = await buildApiAuthCtx(context.db, workspace, context.event);
        requireWorkspaceCapability(authCtx, 'ws.manage_views');
        return await updateSavedView(context.db, workspace, input.id, {
          name: input.name,
          description: input.description,
          viewMode: input.viewMode,
          filters: input.filters,
          config: input.config
        });
      } catch (error) {
        return toORPCError(error);
      }
    }),
    remove: viewRouter.views.remove.handler(async ({ input, context }) => {
      try {
        const workspace = await resolveWorkspace(context.db.catalog, input.workspace);
        const authCtx = await buildApiAuthCtx(context.db, workspace, context.event);
        requireWorkspaceCapability(authCtx, 'ws.manage_views');
        return await deleteSavedView(context.db, workspace, input.id);
      } catch (error) {
        return toORPCError(error);
      }
    })
  },
  pinnedEntities: {
    list: viewRouter.pinnedEntities.list.handler(async ({ input, context }) => {
      try {
        const workspace = await resolveWorkspace(context.db.catalog, input.workspace);
        return await listPinnedEntities(context.db, workspace, context.event);
      } catch (error) {
        return toORPCError(error);
      }
    }),
    create: viewRouter.pinnedEntities.create.handler(async ({ input, context }) => {
      try {
        const workspace = await resolveWorkspace(context.db.catalog, input.workspace);
        return await createPinnedEntity(context.db, workspace, input.entity_id, context.event);
      } catch (error) {
        return toORPCError(error);
      }
    }),
    remove: viewRouter.pinnedEntities.remove.handler(async ({ input, context }) => {
      try {
        const workspace = await resolveWorkspace(context.db.catalog, input.workspace);
        return await deletePinnedEntity(context.db, workspace, input.entityId, context.event);
      } catch (error) {
        return toORPCError(error);
      }
    })
  }
});

export const workspaceViewOpenAPIHandler = new OpenAPIHandler(workspaceViewORPCRouter, {
  clientInterceptors: orpcErrorInterceptors
});

export const createWorkspaceViewORPCHandler = (db: DatabaseAdapter) =>
  defineHandler(async event => {
    const result = await workspaceViewOpenAPIHandler.handle(event.req, {
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
