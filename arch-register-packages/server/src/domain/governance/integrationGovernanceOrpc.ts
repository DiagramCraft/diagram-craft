import { defineHandler } from 'h3';
import { implement } from '@orpc/server';
import { OpenAPIHandler } from '@orpc/openapi/fetch';
import { integrationGovernanceContract } from '@arch-register/api-types/integrationGovernanceContract';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { orpcErrorInterceptors, orpcErrorMiddleware } from '../../utils/orpcErrors';
import {
  createIntegrationGovernanceCase,
  createIntegrationGovernanceInboxItem,
  decideIntegrationGovernanceInboxItem,
  getIntegrationGovernanceCase,
  getIntegrationGovernanceInboxItem,
  listIntegrationGovernanceCases,
  listIntegrationGovernanceInboxItems
} from './integrationGovernanceOperations';

type ORPCContext = { db: DatabaseAdapter; event: AuthenticatedEvent };
const router = implement(integrationGovernanceContract)
  .$context<ORPCContext>()
  .use(orpcErrorMiddleware);

export const integrationGovernanceORPCRouter = router.router({
  integrationGovernance: {
    cases: {
      list: router.integrationGovernance.cases.list.handler(({ input, context }) =>
        listIntegrationGovernanceCases(
          context.db,
          input.params.workspace,
          context.event,
          input.query
        )
      ),
      create: router.integrationGovernance.cases.create.handler(({ input, context }) =>
        createIntegrationGovernanceCase(
          context.db,
          input.params.workspace,
          input.body,
          context.event
        )
      ),
      get: router.integrationGovernance.cases.get.handler(({ input, context }) =>
        getIntegrationGovernanceCase(
          context.db,
          input.params.workspace,
          input.params.id,
          context.event
        )
      ),
      listInboxItems: router.integrationGovernance.cases.listInboxItems.handler(
        ({ input, context }) =>
          listIntegrationGovernanceInboxItems(
            context.db,
            input.params.workspace,
            input.params.id,
            context.event
          )
      ),
      createInboxItem: router.integrationGovernance.cases.createInboxItem.handler(
        ({ input, context }) =>
          createIntegrationGovernanceInboxItem(
            context.db,
            input.params.workspace,
            input.params.id,
            input.body,
            context.event
          )
      )
    },
    inboxItems: {
      get: router.integrationGovernance.inboxItems.get.handler(({ input, context }) =>
        getIntegrationGovernanceInboxItem(
          context.db,
          input.params.workspace,
          input.params.id,
          context.event
        )
      ),
      decide: router.integrationGovernance.inboxItems.decide.handler(({ input, context }) =>
        decideIntegrationGovernanceInboxItem(
          context.db,
          input.params.workspace,
          input.params.id,
          input.body,
          context.event
        )
      )
    }
  }
});

const handler = new OpenAPIHandler(integrationGovernanceORPCRouter, {
  clientInterceptors: orpcErrorInterceptors
});

export const createIntegrationGovernanceORPCHandler = (db: DatabaseAdapter) =>
  defineHandler(async event => {
    const result = await handler.handle(event.req, {
      prefix: '/api',
      context: { db, event: event as AuthenticatedEvent }
    });
    if (result.matched) return result.response;
  });
