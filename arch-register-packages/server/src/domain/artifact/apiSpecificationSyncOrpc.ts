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
        return syncApiSpecificationByExternalKey(
          context.db,
          context.workspace,
          input.params.source,
          input.params.externalKey,
          input.body,
          context.authCtx,
          { id: auditUser.id, displayName: auditUser.display_name }
        );
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
