import { defineHandler } from 'h3';
import { implement } from '@orpc/server';
import { OpenAPIHandler } from '@orpc/openapi/fetch';
import { entityDeprecationContract } from '@arch-register/api-types/entityDeprecationContract';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { orpcErrorInterceptors, orpcErrorMiddleware } from '../../utils/orpcErrors';
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

export const createEntityDeprecationORPCHandler = (db: DatabaseAdapter) => {
  const openAPIHandler = new OpenAPIHandler(createEntityDeprecationORPCRouter(), {
    clientInterceptors: orpcErrorInterceptors
  });
  return defineHandler(async event => {
    const result = await openAPIHandler.handle(event.req, {
      prefix: '/api',
      context: { db, event: event as AuthenticatedEvent }
    });
    if (result.matched) return result.response;
  });
};
