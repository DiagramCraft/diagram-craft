import { defineHandler } from 'h3';
import { implement } from '@orpc/server';
import { OpenAPIHandler } from '@orpc/openapi/fetch';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { toORPCError, orpcErrorInterceptors } from '../../utils/orpcErrors';
import {
  listAssessments,
  getAssessment,
  createAssessment,
  updateAssessment,
  updateAssessmentStatus,
  deleteAssessment
} from './assessmentOperations';
import { assessmentContract } from '@arch-register/api-types/assessmentContract';

type ORPCContext = {
  db: DatabaseAdapter;
  event: AuthenticatedEvent;
};

const assessmentRouter = implement(assessmentContract).$context<ORPCContext>();

export const assessmentORPCRouter = assessmentRouter.router({
  assessments: {
    list: assessmentRouter.assessments.list.handler(async ({ input, context }) => {
      try {
        return await listAssessments(context.db, input.params.workspace, input.params.id, context.event);
      } catch (error) {
        return toORPCError(error);
      }
    }),
    get: assessmentRouter.assessments.get.handler(async ({ input, context }) => {
      try {
        return await getAssessment(
          context.db,
          input.params.workspace,
          input.params.id,
          input.params.assessmentId,
          context.event
        );
      } catch (error) {
        return toORPCError(error);
      }
    }),
    create: assessmentRouter.assessments.create.handler(async ({ input, context }) => {
      try {
        return await createAssessment(
          context.db,
          input.params.workspace,
          input.params.id,
          input.body,
          context.event
        );
      } catch (error) {
        return toORPCError(error);
      }
    }),
    update: assessmentRouter.assessments.update.handler(async ({ input, context }) => {
      try {
        return await updateAssessment(
          context.db,
          input.params.workspace,
          input.params.id,
          input.params.assessmentId,
          input.body,
          context.event
        );
      } catch (error) {
        return toORPCError(error);
      }
    }),
    updateStatus: assessmentRouter.assessments.updateStatus.handler(async ({ input, context }) => {
      try {
        return await updateAssessmentStatus(
          context.db,
          input.params.workspace,
          input.params.id,
          input.params.assessmentId,
          input.body,
          context.event
        );
      } catch (error) {
        return toORPCError(error);
      }
    }),
    remove: assessmentRouter.assessments.remove.handler(async ({ input, context }) => {
      try {
        return await deleteAssessment(
          context.db,
          input.params.workspace,
          input.params.id,
          input.params.assessmentId,
          context.event
        );
      } catch (error) {
        return toORPCError(error);
      }
    })
  }
});

export const assessmentOpenAPIHandler = new OpenAPIHandler(assessmentORPCRouter, {
  clientInterceptors: orpcErrorInterceptors
});

export const createAssessmentORPCHandler = (db: DatabaseAdapter) =>
  defineHandler(async event => {
    const result = await assessmentOpenAPIHandler.handle(event.req, {
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
