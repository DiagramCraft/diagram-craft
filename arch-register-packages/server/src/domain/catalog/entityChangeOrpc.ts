import { defineHandler } from 'h3';
import { implement } from '@orpc/server';
import { OpenAPIHandler } from '@orpc/openapi/fetch';
import { entityChangeContract } from '@arch-register/api-types/entityChangeContract';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { orpcErrorInterceptors, orpcErrorMiddleware } from '../../utils/orpcErrors';
import {
  bypassEntityApproval,
  getEntityChangeProposal,
  getBulkEntityChangeProposal,
  resubmitEntityChangeProposal,
  submitEntityChangeProposal,
  submitBulkEntityChangeProposal,
  withdrawEntityChangeProposal
} from './entityChangeOperations';

type ORPCContext = { db: DatabaseAdapter; event: AuthenticatedEvent };

const router = implement(entityChangeContract).$context<ORPCContext>().use(orpcErrorMiddleware);

export const createEntityChangeORPCRouter = () =>
  router.router({
    entityChanges: {
      get: router.entityChanges.get.handler(({ input, context }) =>
        getEntityChangeProposal(context.db, input.params.workspace, input.params.id, context.event)
      ),
      submit: router.entityChanges.submit.handler(({ input, context }) =>
        submitEntityChangeProposal(
          context.db,
          input.params.workspace,
          input.params.id,
          context.event,
          input.body
        )
      ),
      resubmit: router.entityChanges.resubmit.handler(({ input, context }) =>
        resubmitEntityChangeProposal(
          context.db,
          input.params.workspace,
          input.params.id,
          input.params.proposalId,
          context.event,
          input.body
        )
      ),
      withdraw: router.entityChanges.withdraw.handler(({ input, context }) =>
        withdrawEntityChangeProposal(
          context.db,
          input.params.workspace,
          input.params.id,
          input.params.proposalId,
          context.event,
          input.body.reason
        )
      ),
      bypass: router.entityChanges.bypass.handler(({ input, context }) =>
        bypassEntityApproval(
          context.db,
          input.params.workspace,
          input.params.id,
          context.event,
          input.body
        )
      ),
      submitBulk: router.entityChanges.submitBulk.handler(({ input, context }) =>
        submitBulkEntityChangeProposal(
          context.db,
          input.params.workspace,
          context.event,
          input.body
        )
      ),
      getBulk: router.entityChanges.getBulk.handler(({ input, context }) =>
        getBulkEntityChangeProposal(
          context.db,
          input.params.workspace,
          input.params.proposalId,
          context.event
        )
      )
    }
  });

export const createEntityChangeORPCHandler = (db: DatabaseAdapter) => {
  const openAPIHandler = new OpenAPIHandler(createEntityChangeORPCRouter(), {
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
