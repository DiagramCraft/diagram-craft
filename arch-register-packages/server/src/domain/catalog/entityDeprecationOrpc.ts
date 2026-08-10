import { implement } from '@orpc/server';
import { entityDeprecationContract } from '@arch-register/api-types/entityDeprecationContract';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { createOrpcHandler } from '../../utils/orpcHandler';
import { orpcErrorMiddleware } from '../../utils/orpcErrors';
import {
  acknowledgeEntityDeprecation,
  cancelEntityDeprecation,
  finalizeEntityDeprecation,
  getEntityDeprecation,
  postponeEntityDeprecation,
  proposeEntityDeprecation,
  refreshEntityDeprecationScope
} from './entityDeprecationOperations';

type ORPCContext = { db: DatabaseAdapter; event: AuthenticatedEvent };

const router = implement(entityDeprecationContract)
  .$context<ORPCContext>()
  .use(orpcErrorMiddleware);

export const createEntityDeprecationORPCRouter = () =>
  router.router({
    entityDeprecations: {
      get: router.entityDeprecations.get.handler(({ input, context }) =>
        getEntityDeprecation(context.db, input.params.workspace, input.params.id, context.event)
      ),
      propose: router.entityDeprecations.propose.handler(({ input, context }) =>
        proposeEntityDeprecation(
          context.db,
          input.params.workspace,
          input.params.id,
          context.event,
          input.body
        )
      ),
      acknowledge: router.entityDeprecations.acknowledge.handler(({ input, context }) =>
        acknowledgeEntityDeprecation(
          context.db,
          input.params.workspace,
          input.params.id,
          input.params.caseId,
          context.event,
          input.body
        )
      ),
      refreshScope: router.entityDeprecations.refreshScope.handler(({ input, context }) =>
        refreshEntityDeprecationScope(
          context.db,
          input.params.workspace,
          input.params.id,
          input.params.caseId,
          context.event
        )
      ),
      postpone: router.entityDeprecations.postpone.handler(({ input, context }) =>
        postponeEntityDeprecation(
          context.db,
          input.params.workspace,
          input.params.id,
          input.params.caseId,
          context.event,
          input.body
        )
      ),
      finalize: router.entityDeprecations.finalize.handler(({ input, context }) =>
        finalizeEntityDeprecation(
          context.db,
          input.params.workspace,
          input.params.id,
          input.params.caseId,
          context.event,
          input.body
        )
      ),
      cancel: router.entityDeprecations.cancel.handler(({ input, context }) =>
        cancelEntityDeprecation(
          context.db,
          input.params.workspace,
          input.params.id,
          input.params.caseId,
          context.event,
          input.body
        )
      )
    }
  });

export const createEntityDeprecationORPCHandler = (db: DatabaseAdapter) =>
  createOrpcHandler(createEntityDeprecationORPCRouter(), {
    context: event => ({ db, event: event as AuthenticatedEvent })
  });
