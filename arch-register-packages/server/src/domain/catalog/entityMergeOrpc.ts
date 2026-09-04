import { implement } from '@orpc/server';
import { entityMergeContract } from '@arch-register/api-types/entityMergeContract';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { createOrpcHandler } from '../../utils/orpcHandler';
import { orpcErrorMiddleware } from '../../utils/orpcErrors';
import { previewEntityMerge } from './entityMergeOperations';

type ORPCContext = { db: DatabaseAdapter; event: AuthenticatedEvent };

const router = implement(entityMergeContract).$context<ORPCContext>().use(orpcErrorMiddleware);

export const createEntityMergeORPCRouter = () =>
  router.router({
    entityMerges: {
      preview: router.entityMerges.preview.handler(({ input, context }) =>
        previewEntityMerge(
          context.db,
          input.params.workspace,
          input.params.id,
          input.body.targetId,
          context.event
        )
      )
    }
  });

export const createEntityMergeORPCHandler = (db: DatabaseAdapter) =>
  createOrpcHandler(createEntityMergeORPCRouter(), {
    context: event => ({ db, event: event as AuthenticatedEvent })
  });
