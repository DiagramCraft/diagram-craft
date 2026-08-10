import { implement } from '@orpc/server';
import { relationChangeContract } from '@arch-register/api-types/relationChangeContract';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { createOrpcHandler } from '../../utils/orpcHandler';
import { orpcErrorMiddleware } from '../../utils/orpcErrors';
import {
  bypassRelationApproval,
  getRelationChangeApproval,
  resubmitRelationChangeApproval,
  submitRelationChangeApproval,
  withdrawRelationChangeApproval
} from './relationChangeOperations';

type ORPCContext = { db: DatabaseAdapter; event: AuthenticatedEvent };

const router = implement(relationChangeContract).$context<ORPCContext>().use(orpcErrorMiddleware);

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

export const createRelationChangeORPCHandler = (db: DatabaseAdapter) =>
  createOrpcHandler(createRelationChangeORPCRouter(), {
    context: event => ({ db, event: event as AuthenticatedEvent })
  });
