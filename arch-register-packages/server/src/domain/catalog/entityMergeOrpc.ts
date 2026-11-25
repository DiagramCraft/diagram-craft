import { implement } from '@orpc/server';
import { entityMergeContract } from '@arch-register/api-types/entityMergeContract';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { createOrpcHandler } from '../../utils/orpcHandler';
import { orpcErrorMiddleware } from '../../utils/orpcErrors';
import { executeEntityMerge, previewEntityMerge } from './entityMergeOperations';

type ORPCContext = { db: DatabaseAdapter; event: AuthenticatedEvent };

const base = implement(entityMergeContract).$context<ORPCContext>().use(orpcErrorMiddleware);

const router = base.router({
  entityMerges: {
    preview: base.entityMerges.preview.handler(({ input, context }) =>
      previewEntityMerge(
        context.db,
        input.params.workspace,
        input.params.id,
        input.body.targetId,
        context.event
      )
    ),
    execute: base.entityMerges.execute.handler(({ input, context }) =>
      executeEntityMerge(
        context.db,
        input.params.workspace,
        input.params.id,
        input.body,
        context.event
      )
    )
  }
});

export const createEntityMergeORPCHandler = (db: DatabaseAdapter) =>
  createOrpcHandler(router, {
    context: event => ({ db, event: event as AuthenticatedEvent })
  });
