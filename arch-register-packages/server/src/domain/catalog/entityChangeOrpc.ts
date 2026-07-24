import { defineHandler } from 'h3';
import { implement } from '@orpc/server';
import { OpenAPIHandler } from '@orpc/openapi/fetch';
import { entityChangeContract } from '@arch-register/api-types/entityChangeContract';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { orpcErrorInterceptors, orpcErrorMiddleware } from '../../utils/orpcErrors';
import {
  bypassEntityApproval,
  getEntityChangeApproval,
  getBulkEntityChangeApproval,
  resubmitEntityChangeApproval,
  submitEntityChangeApproval,
  submitBulkEntityChangeApproval,
  withdrawEntityChangeApproval
} from './entityChangeOperations';

type ORPCContext = { db: DatabaseAdapter; event: AuthenticatedEvent };

const router = implement(entityChangeContract).$context<ORPCContext>().use(orpcErrorMiddleware);

export const createEntityChangeORPCRouter = () =>
  router.router({
    entityChanges: {
      get: router.entityChanges.get.handler(({ input, context }) =>
        getEntityChangeApproval(context.db, input.params.workspace, input.params.id, context.event)
      ),
      submit: router.entityChanges.submit.handler(({ input, context }) =>
        submitEntityChangeApproval(
          context.db,
          input.params.workspace,
          input.params.id,
          context.event,
          input.body
        )
      ),
      resubmit: router.entityChanges.resubmit.handler(({ input, context }) =>
        resubmitEntityChangeApproval(
          context.db,
          input.params.workspace,
          input.params.id,
          input.params.approvalId,
          context.event,
          input.body
        )
      ),
      withdraw: router.entityChanges.withdraw.handler(({ input, context }) =>
        withdrawEntityChangeApproval(
          context.db,
          input.params.workspace,
          input.params.id,
          input.params.approvalId,
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
        submitBulkEntityChangeApproval(
          context.db,
          input.params.workspace,
          context.event,
          input.body
        )
      ),
      getBulk: router.entityChanges.getBulk.handler(({ input, context }) =>
        getBulkEntityChangeApproval(
          context.db,
          input.params.workspace,
          input.params.approvalId,
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
