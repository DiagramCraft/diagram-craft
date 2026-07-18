import { defineHandler } from 'h3';
import { implement } from '@orpc/server';
import { OpenAPIHandler } from '@orpc/openapi/fetch';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { orpcErrorInterceptors, orpcErrorMiddleware } from '../../utils/orpcErrors';
import {
  cancelGovernanceCase,
  decideGovernanceAssignment,
  getGovernanceCase,
  listGovernanceCaseEvents,
  listGovernanceCases,
  listMyGovernanceAssignments
} from './governanceOperations';
import { createGovernanceRegistry, type GovernanceRegistry } from './governanceRegistry';
import { governanceContract } from '@arch-register/api-types/governanceContract';

type ORPCContext = {
  db: DatabaseAdapter;
  event: AuthenticatedEvent;
};

const governanceRouter = implement(governanceContract)
  .$context<ORPCContext>()
  .use(orpcErrorMiddleware);

export const createGovernanceORPCRouter = (registry: GovernanceRegistry) =>
  governanceRouter.router({
    cases: {
      list: governanceRouter.cases.list.handler(async ({ input, context }) => {
        return await listGovernanceCases(
          context.db,
          input.params.workspace,
          context.event,
          input.query,
          registry
        );
      }),
      get: governanceRouter.cases.get.handler(async ({ input, context }) => {
        return await getGovernanceCase(
          context.db,
          input.params.workspace,
          input.params.id,
          context.event,
          registry
        );
      }),
      events: governanceRouter.cases.events.handler(async ({ input, context }) => {
        return await listGovernanceCaseEvents(
          context.db,
          input.params.workspace,
          input.params.id,
          context.event,
          registry
        );
      }),
      cancel: governanceRouter.cases.cancel.handler(async ({ input, context }) => {
        return await cancelGovernanceCase(
          context.db,
          input.params.workspace,
          input.params.id,
          context.event,
          input.body,
          registry
        );
      })
    },
    assignments: {
      mine: governanceRouter.assignments.mine.handler(async ({ input, context }) => {
        return await listMyGovernanceAssignments(context.db, input.params.workspace, context.event);
      }),
      decide: governanceRouter.assignments.decide.handler(async ({ input, context }) => {
        return await decideGovernanceAssignment(
          context.db,
          input.params.workspace,
          input.params.id,
          context.event,
          input.body,
          registry
        );
      })
    }
  });

export const createGovernanceORPCHandler = (
  db: DatabaseAdapter,
  registry: GovernanceRegistry = createGovernanceRegistry()
) => {
  const router = createGovernanceORPCRouter(registry);
  const openAPIHandler = new OpenAPIHandler(router, {
    clientInterceptors: orpcErrorInterceptors
  });

  return defineHandler(async event => {
    const result = await openAPIHandler.handle(event.req, {
      prefix: '/api',
      context: {
        db,
        event: event as AuthenticatedEvent
      }
    });

    if (result.matched) {
      return result.response;
    }
  });
};
