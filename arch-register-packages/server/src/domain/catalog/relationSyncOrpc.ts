import { implement } from '@orpc/server';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { createOrpcHandler } from '../../utils/orpcHandler';
import { API_PREFIXES } from '../../constants';
import { entityScoped, orpcErrorMiddleware, workspaceScoped } from '../../utils/orpcErrors';
import { relationSyncContract } from '@arch-register/api-types/relationSyncContract';
import { syncRelationByExternalKey, getRelationByExternalKey } from './relationSyncOperations';

type ORPCContext = {
  db: DatabaseAdapter;
  event: AuthenticatedEvent;
};

const relationSyncRouter = implement(relationSyncContract)
  .$context<ORPCContext>()
  .use(orpcErrorMiddleware)
  .use(workspaceScoped)
  .use(entityScoped);

export const relationSyncORPCRouter = relationSyncRouter.router({
  relationSync: {
    getByExternalKey: relationSyncRouter.relationSync.getByExternalKey.handler(
      async ({ input, context }) => {
        const { workspace, authCtx } = context;
        return await getRelationByExternalKey(
          context.db,
          workspace,
          input.params.source,
          input.params.externalKey,
          authCtx
        );
      }
    ),
    syncByExternalKey: relationSyncRouter.relationSync.syncByExternalKey.handler(
      async ({ input, context }) => {
        const { workspace, authCtx } = context;
        const auditUser = context.event.context.user;
        return await syncRelationByExternalKey(
          context.db,
          workspace,
          input.params.source,
          input.params.externalKey,
          input.body,
          authCtx,
          { id: auditUser.id, displayName: auditUser.display_name }
        );
      }
    )
  }
});

export const createRelationSyncORPCHandler = (db: DatabaseAdapter) =>
  createOrpcHandler(relationSyncORPCRouter, {
    prefix: API_PREFIXES.root,
    context: event => ({ db, event: event as AuthenticatedEvent })
  });
