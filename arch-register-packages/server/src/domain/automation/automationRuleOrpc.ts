import { implement } from '@orpc/server';
import { automationRuleContract } from '@arch-register/api-types/automationRuleContract';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { createOrpcHandler } from '../../utils/orpcHandler';
import { orpcErrorMiddleware } from '../../utils/orpcErrors';
import {
  createAutomationRule,
  deleteAutomationRule,
  listAutomationRuleRuns,
  listAutomationRules,
  updateAutomationRule
} from './automationRuleOperations';

type ORPCContext = { db: DatabaseAdapter; event: AuthenticatedEvent };
const router = implement(automationRuleContract).$context<ORPCContext>().use(orpcErrorMiddleware);

export const automationRuleORPCRouter = router.router({
  automationRules: {
    list: router.automationRules.list.handler(({ input, context }) =>
      listAutomationRules(context.db, input.params.workspace, context.event)
    ),
    create: router.automationRules.create.handler(({ input, context }) =>
      createAutomationRule(context.db, input.params.workspace, input.body, context.event)
    ),
    update: router.automationRules.update.handler(({ input, context }) =>
      updateAutomationRule(
        context.db,
        input.params.workspace,
        input.params.id,
        input.body,
        context.event
      )
    ),
    remove: router.automationRules.remove.handler(({ input, context }) =>
      deleteAutomationRule(context.db, input.params.workspace, input.params.id, context.event)
    ),
    runs: {
      list: router.automationRules.runs.list.handler(({ input, context }) =>
        listAutomationRuleRuns(context.db, input.params.workspace, input.query, context.event)
      )
    }
  }
});

export const createAutomationRuleORPCHandler = (db: DatabaseAdapter) =>
  createOrpcHandler(automationRuleORPCRouter, {
    context: event => ({ db, event: event as AuthenticatedEvent })
  });
