import { defineHandler } from 'h3';
import { implement } from '@orpc/server';
import { OpenAPIHandler } from '@orpc/openapi/fetch';
import { workspaceEntityContract } from '@arch-register/api-types';
import type { DatabaseAdapter } from '../../db/database';
import { buildApiAuthCtx } from '../auth/authorization';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { resolveWorkspace } from '../workspace/resolveWorkspace';
import { toORPCError } from '../../utils/orpcErrors';
import {
  listEntities,
  getEntityFacets,
  getEntityTree,
  getEntity,
  getEntityRelations,
  createEntity,
  updateEntity,
  cloneEntity,
  deleteEntity
} from './entityOperations';

type ORPCContext = {
  db: DatabaseAdapter;
  event: AuthenticatedEvent;
};

const entityRouter = implement(workspaceEntityContract).$context<ORPCContext>();

export const workspaceEntityORPCRouter = entityRouter.router({
  entities: {
    list: entityRouter.entities.list.handler(async ({ input, context }) => {
      try {
        const workspace = await resolveWorkspace(context.db.catalog, input.workspace);
        const authCtx = await buildApiAuthCtx(context.db, workspace, context.event);
        return await listEntities(context.db, workspace, authCtx, {
          schemaId: input._schemaId ?? null,
          owner: input.owner ?? null,
          lifecycle: input.lifecycle ?? null,
          q: input.q ?? '',
          view: input.view ?? 'full',
          limit: input.limit ?? null,
          offset: input.offset ?? 0
        });
      } catch (error) {
        return toORPCError(error);
      }
    }),

    facets: entityRouter.entities.facets.handler(async ({ input, context }) => {
      try {
        const workspace = await resolveWorkspace(context.db.catalog, input.workspace);
        const authCtx = await buildApiAuthCtx(context.db, workspace, context.event);
        return await getEntityFacets(context.db, workspace, authCtx);
      } catch (error) {
        return toORPCError(error);
      }
    }),

    tree: entityRouter.entities.tree.handler(async ({ input, context }) => {
      try {
        const workspace = await resolveWorkspace(context.db.catalog, input.workspace);
        const authCtx = await buildApiAuthCtx(context.db, workspace, context.event);
        return await getEntityTree(context.db, workspace, authCtx, {
          schemaId: input._schemaId ?? null,
          owner: input.owner ?? null,
          lifecycle: input.lifecycle ?? null,
          q: input.q ?? ''
        });
      } catch (error) {
        return toORPCError(error);
      }
    }),

    get: entityRouter.entities.get.handler(async ({ input, context }) => {
      try {
        const workspace = await resolveWorkspace(context.db.catalog, input.workspace);
        const authCtx = await buildApiAuthCtx(context.db, workspace, context.event);
        return await getEntity(context.db, workspace, input.id, authCtx);
      } catch (error) {
        return toORPCError(error);
      }
    }),

    relations: entityRouter.entities.relations.handler(async ({ input, context }) => {
      try {
        const workspace = await resolveWorkspace(context.db.catalog, input.workspace);
        const authCtx = await buildApiAuthCtx(context.db, workspace, context.event);
        return await getEntityRelations(context.db, workspace, input.id, authCtx);
      } catch (error) {
        return toORPCError(error);
      }
    }),

    create: entityRouter.entities.create.handler(async ({ input, context }) => {
      try {
        const workspace = await resolveWorkspace(context.db.catalog, input.workspace);
        const authCtx = await buildApiAuthCtx(context.db, workspace, context.event);
        const auditUser = context.event.context.user;
        return await createEntity(
          context.db,
          workspace,
          input as Record<string, unknown>,
          authCtx,
          { id: auditUser.id, displayName: auditUser.display_name }
        );
      } catch (error) {
        return toORPCError(error);
      }
    }),

    update: entityRouter.entities.update.handler(async ({ input, context }) => {
      try {
        const workspace = await resolveWorkspace(context.db.catalog, input.workspace);
        const authCtx = await buildApiAuthCtx(context.db, workspace, context.event);
        const auditUser = context.event.context.user;
        return await updateEntity(
          context.db,
          workspace,
          input.id,
          input as Record<string, unknown>,
          authCtx,
          { id: auditUser.id, displayName: auditUser.display_name }
        );
      } catch (error) {
        return toORPCError(error);
      }
    }),

    clone: entityRouter.entities.clone.handler(async ({ input, context }) => {
      try {
        const workspace = await resolveWorkspace(context.db.catalog, input.workspace);
        const authCtx = await buildApiAuthCtx(context.db, workspace, context.event);
        const auditUser = context.event.context.user;
        return await cloneEntity(context.db, workspace, input.id, authCtx, {
          id: auditUser.id,
          displayName: auditUser.display_name
        });
      } catch (error) {
        return toORPCError(error);
      }
    }),

    remove: entityRouter.entities.remove.handler(async ({ input, context }) => {
      try {
        const workspace = await resolveWorkspace(context.db.catalog, input.workspace);
        const authCtx = await buildApiAuthCtx(context.db, workspace, context.event);
        const auditUser = context.event.context.user;
        return await deleteEntity(context.db, workspace, input.id, authCtx, {
          id: auditUser.id,
          displayName: auditUser.display_name
        });
      } catch (error) {
        return toORPCError(error);
      }
    })
  }
});

export const workspaceEntityOpenAPIHandler = new OpenAPIHandler(workspaceEntityORPCRouter);

export const createWorkspaceEntityORPCHandler = (db: DatabaseAdapter) =>
  defineHandler(async event => {
    const result = await workspaceEntityOpenAPIHandler.handle(event.req, {
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
