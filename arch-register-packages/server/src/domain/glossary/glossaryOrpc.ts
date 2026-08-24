import { implement } from '@orpc/server';
import { glossaryContract } from '@arch-register/api-types/glossaryContract';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { createOrpcHandler } from '../../utils/orpcHandler';
import { orpcErrorMiddleware } from '../../utils/orpcErrors';
import {
  getGlossaryConfig,
  getGlossaryTerm,
  getGlossaryTermUsage,
  listGlossaryReports,
  listGlossaryTerms
} from './glossaryOperations';

type Context = { db: DatabaseAdapter; event: AuthenticatedEvent };
const router = implement(glossaryContract).$context<Context>().use(orpcErrorMiddleware);

export const glossaryORPCRouter = router.router({
  glossary: {
    config: router.glossary.config.handler(({ input, context }) =>
      getGlossaryConfig(context.db, input.params.workspace, context.event)
    ),
    terms: {
      list: router.glossary.terms.list.handler(({ input, context }) =>
        listGlossaryTerms(context.db, input.params.workspace, input.query ?? {}, context.event)
      ),
      get: router.glossary.terms.get.handler(({ input, context }) =>
        getGlossaryTerm(context.db, input.params.workspace, input.params.id, context.event)
      ),
      usage: router.glossary.terms.usage.handler(({ input, context }) =>
        getGlossaryTermUsage(
          context.db,
          input.params.workspace,
          input.params.id,
          context.event,
          input.query?.limit,
          input.query?.offset
        )
      )
    },
    reports: {
      list: router.glossary.reports.list.handler(({ input, context }) =>
        listGlossaryReports(
          context.db,
          input.params.workspace,
          input.query.kind,
          input.query.limit,
          input.query.offset,
          context.event
        )
      )
    }
  }
});

export const createGlossaryORPCHandler = (db: DatabaseAdapter) =>
  createOrpcHandler(glossaryORPCRouter, {
    context: event => ({ db, event: event as AuthenticatedEvent })
  });
