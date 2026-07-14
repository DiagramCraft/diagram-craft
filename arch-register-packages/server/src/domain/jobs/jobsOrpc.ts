import { defineHandler } from 'h3';
import { implement } from '@orpc/server';
import { OpenAPIHandler } from '@orpc/openapi/fetch';
import { jobsContract } from '@arch-register/api-types/jobsContract';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { orpcErrorInterceptors, orpcErrorMiddleware } from '../../utils/orpcErrors';
import { cancelJobRun, listJobRuns, listJobSchedules } from './jobOperations';

type ORPCContext = {
  db: DatabaseAdapter;
  event: AuthenticatedEvent;
};

const jobsRouter = implement(jobsContract).$context<ORPCContext>().use(orpcErrorMiddleware);

export const jobsORPCRouter = jobsRouter.router({
  jobs: {
    schedules: {
      list: jobsRouter.jobs.schedules.list.handler(async ({ input, context }) => {
        return await listJobSchedules(context.db, input.params.workspace, context.event);
      })
    },
    runs: {
      list: jobsRouter.jobs.runs.list.handler(async ({ input, context }) => {
        return await listJobRuns(context.db, input.params.workspace, input.query, context.event);
      }),
      cancel: jobsRouter.jobs.runs.cancel.handler(async ({ input, context }) => {
        return await cancelJobRun(
          context.db,
          input.params.workspace,
          input.params.id,
          context.event
        );
      })
    }
  }
});

export const jobsOpenAPIHandler = new OpenAPIHandler(jobsORPCRouter, {
  clientInterceptors: orpcErrorInterceptors
});

export const createJobsORPCHandler = (db: DatabaseAdapter) =>
  defineHandler(async event => {
    const result = await jobsOpenAPIHandler.handle(event.req, {
      prefix: '/api',
      context: {
        db,
        event: event as AuthenticatedEvent
      }
    });

    if (result.matched) return result.response;
  });
