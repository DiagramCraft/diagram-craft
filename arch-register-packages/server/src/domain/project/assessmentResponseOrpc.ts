import { defineHandler } from 'h3';
import { implement } from '@orpc/server';
import { OpenAPIHandler } from '@orpc/openapi/fetch';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { orpcErrorInterceptors, orpcErrorMiddleware } from '../../utils/orpcErrors';
import {
  listAssessmentResponses,
  upsertAssessmentResponse,
  exportAssessmentResponsesCsv
} from './assessmentResponseOperations';
import { assessmentResponseContract } from '@arch-register/api-types/assessmentResponseContract';

type ORPCContext = {
  db: DatabaseAdapter;
  event: AuthenticatedEvent;
};

const assessmentResponseRouter = implement(assessmentResponseContract)
  .$context<ORPCContext>()
  .use(orpcErrorMiddleware);

export const assessmentResponseORPCRouter = assessmentResponseRouter.router({
  assessmentResponses: {
    list: assessmentResponseRouter.assessmentResponses.list.handler(async ({ input, context }) => {
      return await listAssessmentResponses(
        context.db,
        input.params.workspace,
        input.params.id,
        input.params.assessmentId,
        context.event
      );
    }),
    upsert: assessmentResponseRouter.assessmentResponses.upsert.handler(
      async ({ input, context }) => {
        return await upsertAssessmentResponse(
          context.db,
          input.params.workspace,
          input.params.id,
          input.params.assessmentId,
          input.params.entityId,
          input.body,
          context.event
        );
      }
    ),
    exportCsv: assessmentResponseRouter.assessmentResponses.exportCsv.handler(
      async ({ input, context }) => {
        return await exportAssessmentResponsesCsv(
          context.db,
          input.params.workspace,
          input.params.id,
          input.params.assessmentId,
          context.event
        );
      }
    )
  }
});

export const assessmentResponseOpenAPIHandler = new OpenAPIHandler(assessmentResponseORPCRouter, {
  clientInterceptors: orpcErrorInterceptors
});

export const createAssessmentResponseORPCHandler = (db: DatabaseAdapter) =>
  defineHandler(async event => {
    const result = await assessmentResponseOpenAPIHandler.handle(event.req, {
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
