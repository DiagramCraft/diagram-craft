import { defineHandler } from 'h3';
import { implement } from '@orpc/server';
import { OpenAPIHandler } from '@orpc/openapi/fetch';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { orpcErrorInterceptors, orpcErrorMiddleware } from '../../utils/orpcErrors';
import {
  listMilestones,
  getMilestone,
  createMilestone,
  updateMilestone,
  deleteMilestone
} from './projectMilestoneOperations';
import { milestoneContract } from '@arch-register/api-types/milestoneContract';

type ORPCContext = {
  db: DatabaseAdapter;
  event: AuthenticatedEvent;
};

const milestoneRouter = implement(milestoneContract)
  .$context<ORPCContext>()
  .use(orpcErrorMiddleware);

export const milestoneORPCRouter = milestoneRouter.router({
  milestones: {
    list: milestoneRouter.milestones.list.handler(async ({ input, context }) => {
      return await listMilestones(
        context.db,
        input.params.workspace,
        input.params.id,
        context.event
      );
    }),
    get: milestoneRouter.milestones.get.handler(async ({ input, context }) => {
      return await getMilestone(
        context.db,
        input.params.workspace,
        input.params.id,
        input.params.milestoneId,
        context.event
      );
    }),
    create: milestoneRouter.milestones.create.handler(async ({ input, context }) => {
      return await createMilestone(
        context.db,
        input.params.workspace,
        input.params.id,
        input.body,
        context.event
      );
    }),
    update: milestoneRouter.milestones.update.handler(async ({ input, context }) => {
      return await updateMilestone(
        context.db,
        input.params.workspace,
        input.params.id,
        input.params.milestoneId,
        input.body,
        context.event
      );
    }),
    remove: milestoneRouter.milestones.remove.handler(async ({ input, context }) => {
      return await deleteMilestone(
        context.db,
        input.params.workspace,
        input.params.id,
        input.params.milestoneId,
        context.event
      );
    })
  }
});

export const milestoneOpenAPIHandler = new OpenAPIHandler(milestoneORPCRouter, {
  clientInterceptors: orpcErrorInterceptors
});

export const createMilestoneORPCHandler = (db: DatabaseAdapter) =>
  defineHandler(async event => {
    const result = await milestoneOpenAPIHandler.handle(event.req, {
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
