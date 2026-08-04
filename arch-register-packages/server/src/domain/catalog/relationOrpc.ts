import { defineHandler } from 'h3';
import { implement } from '@orpc/server';
import { OpenAPIHandler } from '@orpc/openapi/fetch';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { orpcErrorInterceptors, orpcErrorMiddleware } from '../../utils/orpcErrors';
import {
  listWorkspaceRelations,
  queryWorkspaceRelations,
  getWorkspaceRelation,
  createWorkspaceRelation,
  updateWorkspaceRelation,
  deleteWorkspaceRelation,
  listTypedRelationsForEntity
} from './relationOperations';
import {
  listWorkspaceRelationSchemas,
  getWorkspaceRelationSchema
} from './relationSchemaOperations';
import { workspaceRelationContract } from '@arch-register/api-types/relationContract';
import { integrationRelationContract } from '@arch-register/api-types/integrationRelationContract';

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
    query: relationRouter.relations.query.handler(async ({ input, context }) => {
      const { relationQuery, view, limit, offset } = input.query;
      return await queryWorkspaceRelations(
        context.db,
        input.params.workspace,
        relationQuery,
        { view, limit, offset },
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

const integrationRelationRouter = implement(integrationRelationContract)
  .$context<ORPCContext>()
  .use(orpcErrorMiddleware);

export const integrationRelationORPCRouter = integrationRelationRouter.router({
  integrationRelationSchemas: {
    list: integrationRelationRouter.integrationRelationSchemas.list.handler(
      async ({ input, context }) =>
        await listWorkspaceRelationSchemas(context.db, input.params.workspace, context.event)
    ),
    get: integrationRelationRouter.integrationRelationSchemas.get.handler(
      async ({ input, context }) =>
        await getWorkspaceRelationSchema(
          context.db,
          input.params.workspace,
          input.params.id,
          context.event
        )
    )
  },
  integrationRelations: {
    list: integrationRelationRouter.integrationRelations.list.handler(
      async ({ input, context }) => {
        const { schemaId, inEntityId, outEntityId, limit, offset } = input.query;
        return await listWorkspaceRelations(
          context.db,
          input.params.workspace,
          { schemaId, inEntityId, outEntityId },
          { limit, offset },
          context.event
        );
      }
    ),
    get: integrationRelationRouter.integrationRelations.get.handler(
      async ({ input, context }) =>
        await getWorkspaceRelation(
          context.db,
          input.params.workspace,
          input.params.id,
          context.event
        )
    ),
    create: integrationRelationRouter.integrationRelations.create.handler(
      async ({ input, context }) =>
        await createWorkspaceRelation(context.db, input.params.workspace, input.body, context.event)
    ),
    update: integrationRelationRouter.integrationRelations.update.handler(
      async ({ input, context }) =>
        await updateWorkspaceRelation(
          context.db,
          input.params.workspace,
          input.params.id,
          input.body,
          context.event
        )
    ),
    remove: integrationRelationRouter.integrationRelations.remove.handler(
      async ({ input, context }) =>
        await deleteWorkspaceRelation(
          context.db,
          input.params.workspace,
          input.params.id,
          context.event
        )
    ),
    listForEntity: integrationRelationRouter.integrationRelations.listForEntity.handler(
      async ({ input, context }) =>
        await listTypedRelationsForEntity(
          context.db,
          input.params.workspace,
          input.params.id,
          context.event
        )
    )
  }
});

export const integrationRelationOpenAPIHandler = new OpenAPIHandler(integrationRelationORPCRouter, {
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

export const createIntegrationRelationORPCHandler = (db: DatabaseAdapter) =>
  defineHandler(async event => {
    const result = await integrationRelationOpenAPIHandler.handle(event.req, {
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
