import { implement } from '@orpc/server';
import { workspaceMetricContract } from '@arch-register/api-types/metricContract';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { createOrpcHandler } from '../../utils/orpcHandler';
import { orpcErrorMiddleware, workspaceScoped } from '../../utils/orpcErrors';
import { buildApiEntityAuthCtx, requireProjectAccess } from '../auth/authorization';
import { httpAssert } from '../../utils/httpAssert';
import { getBoxMetrics } from './metricOperations';

type ORPCContext = {
  db: DatabaseAdapter;
  event: AuthenticatedEvent;
};

const metricRouter = implement(workspaceMetricContract)
  .$context<ORPCContext>()
  .use(orpcErrorMiddleware)
  .use(workspaceScoped);

export const workspaceMetricORPCRouter = metricRouter.router({
  metrics: {
    rollup: metricRouter.metrics.rollup.handler(async ({ input, context }) => {
      const { workspace, authCtx } = context;
      const { body } = input;

      if (body.projectId) {
        const project = await context.db.project.projects.getProject(workspace, body.projectId);
        httpAssert.present(project, {
          status: 404,
          message: `Project '${body.projectId}' not found`
        });
        requireProjectAccess(authCtx, project.owner);
      }

      const entityAuthCtx = await buildApiEntityAuthCtx(context.db, workspace, context.event);
      return await getBoxMetrics(context.db, workspace, entityAuthCtx, {
        boxEntityIds: body.boxEntityIds,
        metric: body.metric,
        schemaId: body.schemaId,
        owner: body.owner,
        lifecycle: body.lifecycle,
        q: body.q,
        conditions: body.conditions,
        entityQuery: body.entityQuery,
        assessmentId: body.assessmentId,
        projectId: body.projectId,
        projectScope: body.projectScope
      });
    })
  }
});

export const createWorkspaceMetricORPCHandler = (db: DatabaseAdapter) =>
  createOrpcHandler(workspaceMetricORPCRouter, {
    context: event => ({ db, event: event as AuthenticatedEvent })
  });
