import { defineHandler } from 'h3';
import { implement } from '@orpc/server';
import { OpenAPIHandler } from '@orpc/openapi/fetch';
import { relationChangeContract } from '@arch-register/api-types/relationChangeContract';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { orpcErrorInterceptors, orpcErrorMiddleware } from '../../utils/orpcErrors';
import {
  bypassRelationApproval,
  getRelationChangeApproval,
  resubmitRelationChangeApproval,
  submitRelationChangeApproval,
  withdrawRelationChangeApproval
} from './relationChangeOperations';

type ORPCContext = { db: DatabaseAdapter; event: AuthenticatedEvent };

const router = implement(relationChangeContract)
  .$context<ORPCContext>()
  .use(orpcErrorMiddleware);

export const createRelationChangeORPCRouter = () =>
  router.router({
    relationChanges: {
      get: router.relationChanges.get.handler(({ input, context }) =>
        getRelationChangeApproval(
          context.db,
          input.params.workspace,
          input.params.id,
          context.event
        )
      ),
      submit: router.relationChanges.submit.handler(({ input, context }) =>
        submitRelationChangeApproval(
          context.db,
          input.params.workspace,
          input.params.id,
          context.event,
          input.body
        )
      ),
      resubmit: router.relationChanges.resubmit.handler(({ input, context }) =>
        resubmitRelationChangeApproval(
          context.db,
          input.params.workspace,
          input.params.id,
          input.params.approvalId,
          context.event,
          input.body
        )
      ),
      withdraw: router.relationChanges.withdraw.handler(({ input, context }) =>
        withdrawRelationChangeApproval(
          context.db,
          input.params.workspace,
          input.params.id,
          input.params.approvalId,
          context.event,
          input.body.reason
        )
      ),
      bypass: router.relationChanges.bypass.handler(({ input, context }) =>
        bypassRelationApproval(
          context.db,
          input.params.workspace,
          input.params.id,
          context.event,
          input.body
        )
      )
    }
  });

export const createRelationChangeORPCHandler = (db: DatabaseAdapter) => {
  const openAPIHandler = new OpenAPIHandler(createRelationChangeORPCRouter(), {
    clientInterceptors: orpcErrorInterceptors
  });
  return defineHandler(async event => {
    const result = await openAPIHandler.handle(event.req, {
      prefix: '/api/application/v1',
      context: { db, event: event as AuthenticatedEvent }
    });
    if (result.matched) return result.response;
  });
};
