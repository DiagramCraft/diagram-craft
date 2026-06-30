import { defineHandler } from 'h3';
import { implement } from '@orpc/server';
import { OpenAPIHandler } from '@orpc/openapi/fetch';
import type { DatabaseAdapter } from '../../db/database';
import {
  buildApiAuthCtx,
  requireProjectAccess,
  requireProjectAction,
  requireWorkspaceCapability
} from '../auth/authorization';
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
import { workspaceViewContract } from '@arch-register/api-types/viewContract';
import { httpAssert } from '../../utils/httpAssert';

type ORPCContext = {
  db: DatabaseAdapter;
  event: AuthenticatedEvent;
};

const viewRouter = implement(workspaceViewContract).$context<ORPCContext>();

export const workspaceViewORPCRouter = viewRouter.router({
  views: {
    list: viewRouter.views.list.handler(async ({ input, context }) => {
      try {
        const workspace = await resolveWorkspace(context.db.catalog, input.params.workspace);
        const authCtx = await buildApiAuthCtx(context.db, workspace, context.event);
        const projectId = input.query?.projectId ?? null;
        const includeWorkspace = input.query?.includeWorkspace ?? false;

        if (projectId != null) {
          const project = await context.db.project.getProject(workspace, projectId);
          httpAssert.present(project, { status: 404, message: `Project '${projectId}' not found` });
          requireProjectAccess(authCtx, project.owner);
          return await listSavedViews(context.db, workspace, { projectId: project.id, includeWorkspace });
        }

        requireWorkspaceCapability(authCtx, 'ws.view');
        return await listSavedViews(context.db, workspace);
      } catch (error) {
        return toORPCError(error);
      }
    }),
    create: viewRouter.views.create.handler(async ({ input, context }) => {
      try {
        const workspace = await resolveWorkspace(context.db.catalog, input.params.workspace);
        const authCtx = await buildApiAuthCtx(context.db, workspace, context.event);
        if (input.body.scope === 'project') {
          httpAssert.present(input.body.projectId, {
            status: 400,
            message: 'projectId is required for project-scoped views'
          });
          const project = await context.db.project.getProject(workspace, input.body.projectId);
          httpAssert.present(project, {
            status: 404,
            message: `Project '${input.body.projectId}' not found`
          });
          requireProjectAction(authCtx, project.owner, 'edit_project');
        } else {
          requireWorkspaceCapability(authCtx, 'ws.manage_views');
        }
        return await createSavedView(context.db, workspace, {
          scope: input.body.scope,
          projectId: input.body.projectId,
          projectScope: input.body.projectScope,
          name: input.body.name,
          description: input.body.description,
          viewMode: input.body.viewMode,
          filters: input.body.filters,
          config: input.body.config
        });
      } catch (error) {
        return toORPCError(error);
      }
    }),
    update: viewRouter.views.update.handler(async ({ input, context }) => {
      try {
        const workspace = await resolveWorkspace(context.db.catalog, input.params.workspace);
        const authCtx = await buildApiAuthCtx(context.db, workspace, context.event);
        const existing = await context.db.view.getSavedView(workspace, input.params.id);
        httpAssert.present(existing, { status: 404, message: 'View not found' });
        if (existing.project_id == null) {
          requireWorkspaceCapability(authCtx, 'ws.manage_views');
        } else {
          const project = await context.db.project.getProject(workspace, existing.project_id);
          httpAssert.present(project, {
            status: 404,
            message: `Project '${existing.project_id}' not found`
          });
          requireProjectAction(authCtx, project.owner, 'edit_project');
        }
        return await updateSavedView(context.db, workspace, input.params.id, {
          projectScope: input.body.projectScope,
          name: input.body.name,
          description: input.body.description,
          viewMode: input.body.viewMode,
          filters: input.body.filters,
          config: input.body.config
        });
      } catch (error) {
        return toORPCError(error);
      }
    }),
    remove: viewRouter.views.remove.handler(async ({ input, context }) => {
      try {
        const workspace = await resolveWorkspace(context.db.catalog, input.params.workspace);
        const authCtx = await buildApiAuthCtx(context.db, workspace, context.event);
        const existing = await context.db.view.getSavedView(workspace, input.params.id);
        httpAssert.present(existing, { status: 404, message: 'View not found' });
        if (existing.project_id == null) {
          requireWorkspaceCapability(authCtx, 'ws.manage_views');
        } else {
          const project = await context.db.project.getProject(workspace, existing.project_id);
          httpAssert.present(project, {
            status: 404,
            message: `Project '${existing.project_id}' not found`
          });
          requireProjectAction(authCtx, project.owner, 'edit_project');
        }
        return await deleteSavedView(context.db, workspace, input.params.id);
      } catch (error) {
        return toORPCError(error);
      }
    })
  },
  pinnedEntities: {
    list: viewRouter.pinnedEntities.list.handler(async ({ input, context }) => {
      try {
        const workspace = await resolveWorkspace(context.db.catalog, input.params.workspace);
        return await listPinnedEntities(context.db, workspace, context.event);
      } catch (error) {
        return toORPCError(error);
      }
    }),
    create: viewRouter.pinnedEntities.create.handler(async ({ input, context }) => {
      try {
        const workspace = await resolveWorkspace(context.db.catalog, input.params.workspace);
        return await createPinnedEntity(context.db, workspace, input.body.entity_id, context.event);
      } catch (error) {
        return toORPCError(error);
      }
    }),
    remove: viewRouter.pinnedEntities.remove.handler(async ({ input, context }) => {
      try {
        const workspace = await resolveWorkspace(context.db.catalog, input.params.workspace);
        return await deletePinnedEntity(context.db, workspace, input.params.id, context.event);
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
