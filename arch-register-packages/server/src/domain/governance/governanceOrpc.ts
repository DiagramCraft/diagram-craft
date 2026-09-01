import { implement } from '@orpc/server';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { createOrpcHandler } from '../../utils/orpcHandler';
import { orpcErrorMiddleware } from '../../utils/orpcErrors';
import {
  cancelGovernanceCase,
  decideGovernanceAssignment,
  getGovernanceCase,
  listGovernanceCaseEvents,
  listGovernanceCases,
  listMyGovernanceAssignments,
  listMySubmittedGovernanceCases,
  countMyGovernanceAssignments,
  sendGovernanceCaseReminder
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
        }),
        remind: governanceRouter.governance.cases.remind.handler(async ({ input, context }) => {
          return await sendGovernanceCaseReminder(
            context.db,
            input.params.workspace,
            input.params.id,
            context.event,
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
            input.query,
            registry
          );
        }),
        count: governanceRouter.governance.assignments.count.handler(async ({ input, context }) => {
          return await countMyGovernanceAssignments(
            context.db,
            input.params.workspace,
            context.event,
            registry
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
            input.query,
            registry
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
  return createOrpcHandler(router, {
    context: event => ({ db, event: event as AuthenticatedEvent })
  });
};
