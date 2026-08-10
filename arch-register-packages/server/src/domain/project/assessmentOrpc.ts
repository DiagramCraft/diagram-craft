import { implement } from '@orpc/server';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { createOrpcHandler } from '../../utils/orpcHandler';
import { orpcErrorMiddleware } from '../../utils/orpcErrors';
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

const assessmentRouter = implement(assessmentContract)
  .$context<ORPCContext>()
  .use(orpcErrorMiddleware);

export const assessmentORPCRouter = assessmentRouter.router({
  assessments: {
    list: assessmentRouter.assessments.list.handler(async ({ input, context }) => {
      return await listAssessments(context.db, input.params.workspace, context.event);
    }),
    get: assessmentRouter.assessments.get.handler(async ({ input, context }) => {
      return await getAssessment(
        context.db,
        input.params.workspace,
        input.params.assessmentId,
        context.event
      );
    }),
    create: assessmentRouter.assessments.create.handler(async ({ input, context }) => {
      return await createAssessment(context.db, input.params.workspace, input.body, context.event);
    }),
    update: assessmentRouter.assessments.update.handler(async ({ input, context }) => {
      return await updateAssessment(
        context.db,
        input.params.workspace,
        input.params.assessmentId,
        input.body,
        context.event
      );
    }),
    updateStatus: assessmentRouter.assessments.updateStatus.handler(async ({ input, context }) => {
      return await updateAssessmentStatus(
        context.db,
        input.params.workspace,
        input.params.assessmentId,
        input.body,
        context.event
      );
    }),
    remove: assessmentRouter.assessments.remove.handler(async ({ input, context }) => {
      return await deleteAssessment(
        context.db,
        input.params.workspace,
        input.params.assessmentId,
        context.event
      );
    })
  }
});

export const createAssessmentORPCHandler = (db: DatabaseAdapter) =>
  createOrpcHandler(assessmentORPCRouter, {
    context: event => ({ db, event: event as AuthenticatedEvent })
  });
