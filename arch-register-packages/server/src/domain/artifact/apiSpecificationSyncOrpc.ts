import { implement } from '@orpc/server';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { createOrpcHandler } from '../../utils/orpcHandler';
import { API_PREFIXES } from '../../constants';
import { apiSpecificationSyncContract } from '@arch-register/api-types/apiSpecificationSyncContract';
import { entityScoped, orpcErrorMiddleware, workspaceScoped } from '../../utils/orpcErrors';
import {
  refreshApiSpecificationByExternalKey,
  syncApiSpecificationByExternalKey
} from './apiSpecificationSyncOperations';
import {
  recordIntegrationSyncItem,
  validateIntegrationSyncContext
} from '../integrationSync/integrationSyncOperations';

type ORPCContext = {
  db: DatabaseAdapter;
  event: AuthenticatedEvent;
};

const router = implement(apiSpecificationSyncContract)
  .$context<ORPCContext>()
  .use(orpcErrorMiddleware)
  .use(workspaceScoped)
  .use(entityScoped);

export const apiSpecificationSyncORPCRouter = router.router({
  apiSpecificationSync: {
    syncByExternalKey: router.apiSpecificationSync.syncByExternalKey.handler(
      async ({ input, context }) => {
        const auditUser = context.event.context.user;
        const { syncContext, ...syncBody } = input.body;
        await validateIntegrationSyncContext(context.db, {
          workspace: context.workspace,
          sourceKey: input.params.source,
          runId: syncContext.runId,
          scopeKey: syncContext.scopeKey
        });
        const result = await syncApiSpecificationByExternalKey(
          context.db,
          context.workspace,
          input.params.source,
          input.params.externalKey,
          syncBody,
          context.authCtx,
          { id: auditUser.id, displayName: auditUser.display_name }
        );
        await recordIntegrationSyncItem(context.db, {
          workspace: context.workspace,
          sourceKey: input.params.source,
          runId: syncContext.runId,
          scopeKey: syncContext.scopeKey,
          recordType: 'entity',
          externalKey: input.params.externalKey,
          recordId: result.entity._uid
        });
        if (result.artifact?.sourceKey) {
          await recordIntegrationSyncItem(context.db, {
            workspace: context.workspace,
            sourceKey: input.params.source,
            runId: syncContext.runId,
            scopeKey: syncContext.scopeKey,
            recordType: 'artifact',
            externalKey: result.artifact.sourceKey,
            recordId: result.artifact.id
          });
        }
        return result;
      }
    ),
    refreshByExternalKey: router.apiSpecificationSync.refreshByExternalKey.handler(
      async ({ input, context }) =>
        refreshApiSpecificationByExternalKey(
          context.db,
          context.workspace,
          input.params.source,
          input.params.externalKey,
          input.body.sourceKey,
          context.authCtx
        )
    )
  }
});

export const createApiSpecificationSyncORPCHandler = (db: DatabaseAdapter) =>
  // Integration routes use the same root prefix as the existing entity/relation sync APIs.
  createOrpcHandler(apiSpecificationSyncORPCRouter, {
    prefix: API_PREFIXES.root,
    context: event => ({ db, event: event as AuthenticatedEvent })
  });
