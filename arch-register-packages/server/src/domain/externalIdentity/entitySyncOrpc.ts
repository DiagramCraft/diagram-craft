import { defineHandler } from 'h3';
import { implement } from '@orpc/server';
import { OpenAPIHandler } from '@orpc/openapi/fetch';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import {
  entityScoped,
  orpcErrorInterceptors,
  orpcErrorMiddleware,
  workspaceScoped
} from '../../utils/orpcErrors';
import { entitySyncContract } from '@arch-register/api-types/entitySyncContract';
import { syncEntityByExternalKey } from './entitySyncOperations';

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

export const entitySyncOpenAPIHandler = new OpenAPIHandler(entitySyncORPCRouter, {
  clientInterceptors: orpcErrorInterceptors
});

export const createEntitySyncORPCHandler = (db: DatabaseAdapter) =>
  defineHandler(async event => {
    const result = await entitySyncOpenAPIHandler.handle(event.req, {
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
