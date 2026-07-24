import { defineHandler } from 'h3';
import { implement } from '@orpc/server';
import { OpenAPIHandler } from '@orpc/openapi/fetch';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import {
  orpcErrorInterceptors,
  orpcErrorMiddleware,
  workspaceScoped
} from '../../utils/orpcErrors';
import { workspaceCollectionContract } from '@arch-register/api-types/collectionContract';
import {
  addEntityToCollection,
  createCollection,
  deleteCollection,
  listCollections,
  removeEntityFromCollection,
  updateCollection
} from './collectionOperations';

type ORPCContext = { db: DatabaseAdapter; event: AuthenticatedEvent };

const collectionRouter = implement(workspaceCollectionContract)
  .$context<ORPCContext>()
  .use(orpcErrorMiddleware)
  .use(workspaceScoped);

export const workspaceCollectionORPCRouter = collectionRouter.router({
  collections: {
    list: collectionRouter.collections.list.handler(async ({ input, context }) => {
      const { workspace } = context;
      return await listCollections(context.db, workspace, context.event, input.query?.entityId);
    }),
    create: collectionRouter.collections.create.handler(async ({ input, context }) => {
      const { workspace } = context;
      return await createCollection(context.db, workspace, context.event, input.body.name);
    }),
    update: collectionRouter.collections.update.handler(async ({ input, context }) => {
      const { workspace } = context;
      return await updateCollection(
        context.db,
        workspace,
        input.params.id,
        context.event,
        input.body.name
      );
    }),
    remove: collectionRouter.collections.remove.handler(async ({ input, context }) => {
      const { workspace } = context;
      return await deleteCollection(context.db, workspace, input.params.id, context.event);
    }),
    addEntity: collectionRouter.collections.addEntity.handler(async ({ input, context }) => {
      const { workspace } = context;
      return await addEntityToCollection(
        context.db,
        workspace,
        input.params.id,
        input.body.entity_id,
        context.event
      );
    }),
    removeEntity: collectionRouter.collections.removeEntity.handler(async ({ input, context }) => {
      const { workspace } = context;
      return await removeEntityFromCollection(
        context.db,
        workspace,
        input.params.id,
        input.params.entityId,
        context.event
      );
    })
  }
});

export const workspaceCollectionOpenAPIHandler = new OpenAPIHandler(workspaceCollectionORPCRouter, {
  clientInterceptors: orpcErrorInterceptors
});

export const createWorkspaceCollectionORPCHandler = (db: DatabaseAdapter) =>
  defineHandler(async event => {
    const result = await workspaceCollectionOpenAPIHandler.handle(event.req, {
      prefix: '/api',
      context: { db, event: event as AuthenticatedEvent }
    });
    if (result.matched) return result.response;
  });
