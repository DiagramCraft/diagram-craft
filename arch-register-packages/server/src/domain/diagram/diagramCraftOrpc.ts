import { defineHandler } from 'h3';
import { implement } from '@orpc/server';
import { OpenAPIHandler } from '@orpc/openapi/fetch';
import { diagramCraftContract } from '@arch-register/api-types';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { toORPCError, orpcErrorInterceptors } from '../../utils/orpcErrors';
import { resolveWorkspace } from '../workspace/resolveWorkspace';
import { toDiagramCraftData, toDiagramCraftSchema } from './diagramCraftTransforms';
import type { SchemaDbResult } from '../catalog/db/catalogDatabase';

type ORPCContext = {
  db: DatabaseAdapter;
  event: AuthenticatedEvent;
};

const diagramCraftRouter = implement(diagramCraftContract).$context<ORPCContext>();

export const diagramCraftORPCRouter = diagramCraftRouter.router({
  diagramCraft: {
    listSchemas: diagramCraftRouter.diagramCraft.listSchemas.handler(async ({ input, context }) => {
      try {
        const workspace = await resolveWorkspace(context.db.catalog, input.workspace);
        const rows = (await context.db.catalog.listSchemas(workspace)) as SchemaDbResult[];
        const enums = await context.db.catalog.listEnums(workspace);
        return rows.map(row => toDiagramCraftSchema(row, enums));
      } catch (error) {
        return toORPCError(error);
      }
    }),

    listData: diagramCraftRouter.diagramCraft.listData.handler(async ({ input, context }) => {
      try {
        const workspace = await resolveWorkspace(context.db.catalog, input.workspace);
        const rows = await context.db.catalog.listEntities(workspace);
        return rows.map(toDiagramCraftData);
      } catch (error) {
        return toORPCError(error);
      }
    })
  }
});

export const diagramCraftOpenAPIHandler = new OpenAPIHandler(diagramCraftORPCRouter, {
  clientInterceptors: orpcErrorInterceptors
});

export const createDiagramCraftORPCHandler = (db: DatabaseAdapter) =>
  defineHandler(async event => {
    const result = await diagramCraftOpenAPIHandler.handle(event.req, {
      prefix: '/api',
      context: { db, event: event as AuthenticatedEvent }
    });
    if (result.matched) return result.response;
  });
