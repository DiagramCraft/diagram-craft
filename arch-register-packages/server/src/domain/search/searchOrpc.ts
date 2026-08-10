import { implement, ORPCError } from '@orpc/server';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { createOrpcHandler } from '../../utils/orpcHandler';
import { orpcErrorMiddleware } from '../../utils/orpcErrors';
import { searchWorkspace, SEARCH_TYPES } from './searchOperations';
import { searchContract } from '@arch-register/api-types/searchContract';

type ORPCContext = {
  db: DatabaseAdapter;
  event: AuthenticatedEvent;
};

const searchRouter = implement(searchContract).$context<ORPCContext>().use(orpcErrorMiddleware);

export const searchORPCRouter = searchRouter.router({
  search: {
    query: searchRouter.search.query.handler(async ({ input, context }) => {
      if (input.query.types != null && input.query.types !== '') {
        const parsed = input.query.types.split(',').map(t => t.trim());
        const invalid = parsed.filter(
          t => !SEARCH_TYPES.includes(t as (typeof SEARCH_TYPES)[number])
        );
        if (invalid.length > 0) {
          throw new ORPCError('BAD_REQUEST', {
            message: `types must be a comma-separated list of: ${SEARCH_TYPES.join(', ')}`
          });
        }
      }
      return await searchWorkspace(context.db, input.params.workspace, input.query, context.event);
    })
  }
});

export const createSearchORPCHandler = (db: DatabaseAdapter) =>
  createOrpcHandler(searchORPCRouter, {
    context: event => ({ db, event: event as AuthenticatedEvent })
  });
