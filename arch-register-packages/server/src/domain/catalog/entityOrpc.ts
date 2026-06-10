import { defineHandler } from 'h3';
import { implement } from '@orpc/server';
import { OpenAPIHandler } from '@orpc/openapi/fetch';
import { workspaceEntityContract } from '@arch-register/api-types';
import type { DatabaseAdapter } from '../../db/database';
import { buildApiAuthCtx, requireEntityAction } from '../auth/authorization';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { resolveWorkspace } from '../workspace/resolveWorkspace';
import { toORPCError, orpcErrorInterceptors } from '../../utils/orpcErrors';
import { httpAssert } from '../../utils/httpAssert';
import { buildEntityGrantInputs } from './dataHelpers';
import { importParse, importCommit } from './importOperations';
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
    }),

    getAccess: entityRouter.entities.getAccess.handler(async ({ input, context }) => {
      try {
        const workspace = await resolveWorkspace(context.db.catalog, input.workspace);
        const authCtx = await buildApiAuthCtx(context.db, workspace, context.event);
        const entity = await context.db.catalog.getEntity(workspace, input.id);
        httpAssert.present(entity, { status: 404, message: `Data record '${input.id}' not found` });
        requireEntityAction(
          authCtx,
          entity,
          'view_entity',
          'You do not have access to view this entity'
        );
        const grants = await context.db.catalog.getEntityGrants(workspace, input.id);
        return {
          owner: entity.owner,
          visibility_mode: entity.visibility_mode,
          grants: grants.map(g => ({ ...g, created_at: g.created_at.toISOString() }))
        };
      } catch (error) {
        return toORPCError(error);
      }
    }),

    updateAccess: entityRouter.entities.updateAccess.handler(async ({ input, context }) => {
      try {
        const workspace = await resolveWorkspace(context.db.catalog, input.workspace);
        const authCtx = await buildApiAuthCtx(context.db, workspace, context.event);
        const entity = await context.db.catalog.getEntity(workspace, input.id);
        httpAssert.present(entity, { status: 404, message: `Data record '${input.id}' not found` });
        requireEntityAction(
          authCtx,
          entity,
          'admin_entity',
          'You do not have permission to manage entity access'
        );
        const rows = buildEntityGrantInputs(workspace, input.id, input.grants, new Date());
        const grants = await context.db.catalog.replaceEntityGrants(workspace, input.id, rows);
        return {
          owner: entity.owner,
          visibility_mode: entity.visibility_mode,
          grants: grants.map(g => ({ ...g, created_at: g.created_at.toISOString() }))
        };
      } catch (error) {
        return toORPCError(error);
      }
    }),

    importParse: entityRouter.entities.importParse.handler(async ({ input, context }) => {
      try {
        const workspace = await resolveWorkspace(context.db.catalog, input.workspace);
        const authCtx = await buildApiAuthCtx(context.db, workspace, context.event);
        return await importParse(context.db, authCtx, {
          workspace,
          schemaId: input.schemaId,
          csvContent: input.csvContent
        });
      } catch (error) {
        return toORPCError(error);
      }
    }),

    importCommit: entityRouter.entities.importCommit.handler(async ({ input, context }) => {
      try {
        const workspace = await resolveWorkspace(context.db.catalog, input.workspace);
        const authCtx = await buildApiAuthCtx(context.db, workspace, context.event);
        const auditUser = context.event.context.user;
        return await importCommit(context.db, authCtx, {
          workspace,
          schemaId: input.schemaId,
          entities: input.entities as Array<Record<string, unknown> & { _existingId?: string }>,
          auditUser: { id: auditUser.id, display_name: auditUser.display_name }
        });
      } catch (error) {
        return toORPCError(error);
      }
    })
  }
});

export const workspaceEntityOpenAPIHandler = new OpenAPIHandler(workspaceEntityORPCRouter, {
  clientInterceptors: orpcErrorInterceptors
});

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
