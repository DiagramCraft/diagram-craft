import { defineHandler } from 'h3';
import { implement } from '@orpc/server';
import { OpenAPIHandler } from '@orpc/openapi/fetch';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { orpcErrorInterceptors, orpcErrorMiddleware } from '../../utils/orpcErrors';
import {
  listWorkspaceRelations,
  getWorkspaceRelation,
  createWorkspaceRelation,
  updateWorkspaceRelation,
  deleteWorkspaceRelation,
  listTypedRelationsForEntity
} from './relationOperations';
import { workspaceRelationContract } from '@arch-register/api-types/relationContract';

type ORPCContext = {
  db: DatabaseAdapter;
  event: AuthenticatedEvent;
};

const relationRouter = implement(workspaceRelationContract)
  .$context<ORPCContext>()
  .use(orpcErrorMiddleware);

export const workspaceRelationORPCRouter = relationRouter.router({
  relations: {
    list: relationRouter.relations.list.handler(async ({ input, context }) => {
      const { schemaId, inEntityId, outEntityId, limit, offset } = input.query;
      return await listWorkspaceRelations(
        context.db,
        input.params.workspace,
        { schemaId, inEntityId, outEntityId },
        { limit, offset },
        context.event
      );
    }),
    get: relationRouter.relations.get.handler(async ({ input, context }) => {
      return await getWorkspaceRelation(
        context.db,
        input.params.workspace,
        input.params.id,
        context.event
      );
    }),
    create: relationRouter.relations.create.handler(async ({ input, context }) => {
      return await createWorkspaceRelation(
        context.db,
        input.params.workspace,
        input.body,
        context.event
      );
    }),
    update: relationRouter.relations.update.handler(async ({ input, context }) => {
      return await updateWorkspaceRelation(
        context.db,
        input.params.workspace,
        input.params.id,
        input.body,
        context.event
      );
    }),
    remove: relationRouter.relations.remove.handler(async ({ input, context }) => {
      return await deleteWorkspaceRelation(
        context.db,
        input.params.workspace,
        input.params.id,
        context.event
      );
    }),
    listForEntity: relationRouter.relations.listForEntity.handler(async ({ input, context }) => {
      return await listTypedRelationsForEntity(
        context.db,
        input.params.workspace,
        input.params.id,
        context.event
      );
    })
  }
});

export const workspaceRelationOpenAPIHandler = new OpenAPIHandler(workspaceRelationORPCRouter, {
  clientInterceptors: orpcErrorInterceptors
});

export const createWorkspaceRelationORPCHandler = (db: DatabaseAdapter) =>
  defineHandler(async event => {
    const result = await workspaceRelationOpenAPIHandler.handle(event.req, {
      prefix: '/api/application/v1',
      context: {
        db,
        event: event as AuthenticatedEvent
      }
    });

    if (result.matched) {
      return result.response;
    }
  });
