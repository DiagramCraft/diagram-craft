import { implement } from '@orpc/server';
import { integrationSyncContract } from '@arch-register/api-types/integrationSyncContract';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { API_PREFIXES } from '../../constants';
import { createOrpcHandler } from '../../utils/orpcHandler';
import { orpcErrorMiddleware, workspaceScoped } from '../../utils/orpcErrors';
import {
  finishIntegrationSyncRun,
  getIntegrationSyncDashboard,
  relinkIntegrationRecord,
  retryIntegrationSyncRun,
  startIntegrationSyncRun,
  stopManagingIntegrationRecord
} from './integrationSyncOperations';

type ORPCContext = { db: DatabaseAdapter; event: AuthenticatedEvent };

const router = implement(integrationSyncContract)
  .$context<ORPCContext>()
  .use(orpcErrorMiddleware)
  .use(workspaceScoped);

export const integrationSyncORPCRouter = router.router({
  integrationSync: {
    dashboard: router.integrationSync.dashboard.handler(({ input, context }) =>
      getIntegrationSyncDashboard(context.db, input.params.workspace, context.event)
    ),
    startRun: router.integrationSync.startRun.handler(({ input, context }) =>
      startIntegrationSyncRun(
        context.db,
        input.params.workspace,
        input.params.sourceKey,
        input.body,
        context.event
      )
    ),
    finishRun: router.integrationSync.finishRun.handler(({ input, context }) =>
      finishIntegrationSyncRun(context.db, input.params.workspace, input.params.runId, input.body, context.event)
    ),
    retryRun: router.integrationSync.retryRun.handler(({ input, context }) =>
      retryIntegrationSyncRun(context.db, input.params.workspace, input.params.runId, context.event)
    ),
    relinkRecord: router.integrationSync.relinkRecord.handler(({ input, context }) =>
      relinkIntegrationRecord(
        context.db,
        input.params.workspace,
        input.params.id,
        input.body.recordId,
        context.event
      )
    ),
    stopManaging: router.integrationSync.stopManaging.handler(({ input, context }) =>
      stopManagingIntegrationRecord(
        context.db,
        input.params.workspace,
        input.params.id,
        context.event
      )
    )
  }
});

export const createIntegrationSyncORPCHandler = (db: DatabaseAdapter) =>
  createOrpcHandler(integrationSyncORPCRouter, {
    prefix: API_PREFIXES.root,
    context: event => ({ db, event: event as AuthenticatedEvent })
  });
