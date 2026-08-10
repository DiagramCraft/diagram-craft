import { implement } from '@orpc/server';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { createOrpcHandler } from '../../utils/orpcHandler';
import { orpcErrorMiddleware } from '../../utils/orpcErrors';
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
  .use(orpcErrorMiddleware);

export const workspaceCollectionORPCRouter = collectionRouter.router({
  collections: {
    list: collectionRouter.collections.list.handler(async ({ input, context }) => {
      return await listCollections(
        context.db,
        input.params.workspace,
        context.event,
        input.query?.entityId
      );
    }),
    create: collectionRouter.collections.create.handler(async ({ input, context }) => {
      return await createCollection(
        context.db,
        input.params.workspace,
        context.event,
        input.body.name
      );
    }),
    update: collectionRouter.collections.update.handler(async ({ input, context }) => {
      return await updateCollection(
        context.db,
        input.params.workspace,
        input.params.id,
        context.event,
        input.body.name
      );
    }),
    remove: collectionRouter.collections.remove.handler(async ({ input, context }) => {
      return await deleteCollection(
        context.db,
        input.params.workspace,
        input.params.id,
        context.event
      );
    }),
    addEntity: collectionRouter.collections.addEntity.handler(async ({ input, context }) => {
      return await addEntityToCollection(
        context.db,
        input.params.workspace,
        input.params.id,
        input.body.entity_id,
        context.event
      );
    }),
    removeEntity: collectionRouter.collections.removeEntity.handler(async ({ input, context }) => {
      return await removeEntityFromCollection(
        context.db,
        input.params.workspace,
        input.params.id,
        input.params.entityId,
        context.event
      );
    })
  }
});

export const createWorkspaceCollectionORPCHandler = (db: DatabaseAdapter) =>
  createOrpcHandler(workspaceCollectionORPCRouter, {
    context: event => ({ db, event: event as AuthenticatedEvent })
  });
