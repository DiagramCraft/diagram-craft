import { defineHandler } from 'h3';
import { implement, ORPCError } from '@orpc/server';
import { OpenAPIHandler } from '@orpc/openapi/fetch';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { toORPCError, orpcErrorInterceptors } from '../../utils/orpcErrors';
import { searchWorkspace, SEARCH_TYPES } from './searchOperations';
import { searchContract } from '@arch-register/api-types/searchContract';

type ORPCContext = {
  db: DatabaseAdapter;
  event: AuthenticatedEvent;
};

const searchRouter = implement(searchContract).$context<ORPCContext>();

export const searchORPCRouter = searchRouter.router({
  search: {
    query: searchRouter.search.query.handler(async ({ input, context }) => {
      try {
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
        return await searchWorkspace(
          context.db,
          input.params.workspace,
          input.query,
          context.event
        );
      } catch (error) {
        return toORPCError(error);
      }
    })
  }
});

export const searchOpenAPIHandler = new OpenAPIHandler(searchORPCRouter, {
  clientInterceptors: orpcErrorInterceptors
});

export const createSearchORPCHandler = (db: DatabaseAdapter) =>
  defineHandler(async event => {
    const result = await searchOpenAPIHandler.handle(event.req, {
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
