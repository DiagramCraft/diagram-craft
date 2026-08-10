import { implement } from '@orpc/server';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { createOrpcHandler } from '../../utils/orpcHandler';
import { API_PREFIXES } from '../../constants';
import { entityScoped, orpcErrorMiddleware, workspaceScoped } from '../../utils/orpcErrors';
import { entitySyncContract } from '@arch-register/api-types/entitySyncContract';
import { syncEntityByExternalKey, getEntityByExternalKey } from './entitySyncOperations';
import { getEntity } from '../catalog/entityQueryOperations';
import { updateEntity } from '../catalog/entityMutationOperations';

type ORPCContext = {
  db: DatabaseAdapter;
  event: AuthenticatedEvent;
};

const entitySyncRouter = implement(entitySyncContract)
  .$context<ORPCContext>()
  .use(orpcErrorMiddleware)
  .use(workspaceScoped)
  .use(entityScoped);

export const entitySyncORPCRouter = entitySyncRouter.router({
  entitySync: {
    getById: entitySyncRouter.entitySync.getById.handler(async ({ input, context }) => {
      const { workspace, authCtx } = context;
      return await getEntity(context.db, workspace, input.params.id, authCtx);
    }),
    updateById: entitySyncRouter.entitySync.updateById.handler(async ({ input, context }) => {
      const { workspace, authCtx } = context;
      const auditUser = context.event.context.user;
      return await updateEntity(
        context.db,
        workspace,
        input.params.id,
        input.body as Record<string, unknown>,
        authCtx,
        { id: auditUser.id, displayName: auditUser.display_name }
      );
    }),
    getByExternalKey: entitySyncRouter.entitySync.getByExternalKey.handler(
      async ({ input, context }) => {
        const { workspace, authCtx } = context;
        return await getEntityByExternalKey(
          context.db,
          workspace,
          input.params.source,
          input.params.externalKey,
          authCtx
        );
      }
    ),
    syncByExternalKey: entitySyncRouter.entitySync.syncByExternalKey.handler(
      async ({ input, context }) => {
        const { workspace, authCtx } = context;
        const auditUser = context.event.context.user;
        return await syncEntityByExternalKey(
          context.db,
          workspace,
          input.params.source,
          input.params.externalKey,
          input.body as Record<string, unknown>,
          authCtx,
          { id: auditUser.id, displayName: auditUser.display_name }
        );
      }
    )
  }
});

export const createEntitySyncORPCHandler = (db: DatabaseAdapter) =>
  createOrpcHandler(entitySyncORPCRouter, {
    prefix: API_PREFIXES.root,
    context: event => ({ db, event: event as AuthenticatedEvent })
  });
