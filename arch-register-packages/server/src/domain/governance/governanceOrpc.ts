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
  listMyGovernanceAssignments,
  listMySubmittedGovernanceCases,
  countMyGovernanceAssignments
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
    governance: {
      cases: {
        list: governanceRouter.governance.cases.list.handler(async ({ input, context }) => {
          return await listGovernanceCases(
            context.db,
            input.params.workspace,
            context.event,
            input.query,
            registry
          );
        }),
        get: governanceRouter.governance.cases.get.handler(async ({ input, context }) => {
          return await getGovernanceCase(
            context.db,
            input.params.workspace,
            input.params.id,
            context.event,
            registry
          );
        }),
        events: governanceRouter.governance.cases.events.handler(async ({ input, context }) => {
          return await listGovernanceCaseEvents(
            context.db,
            input.params.workspace,
            input.params.id,
            context.event,
            registry
          );
        }),
        cancel: governanceRouter.governance.cases.cancel.handler(async ({ input, context }) => {
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
        mine: governanceRouter.governance.assignments.mine.handler(async ({ input, context }) => {
          return await listMyGovernanceAssignments(
            context.db,
            input.params.workspace,
            context.event,
            input.query
          );
        }),
        count: governanceRouter.governance.assignments.count.handler(async ({ input, context }) => {
          return await countMyGovernanceAssignments(
            context.db,
            input.params.workspace,
            context.event
          );
        }),
        decide: governanceRouter.governance.assignments.decide.handler(
          async ({ input, context }) => {
            return await decideGovernanceAssignment(
              context.db,
              input.params.workspace,
              input.params.id,
              context.event,
              input.body,
              registry
            );
          }
        )
      },
      submissions: {
        mine: governanceRouter.governance.submissions.mine.handler(async ({ input, context }) => {
          return await listMySubmittedGovernanceCases(
            context.db,
            input.params.workspace,
            context.event,
            input.query
          );
        })
      }
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
