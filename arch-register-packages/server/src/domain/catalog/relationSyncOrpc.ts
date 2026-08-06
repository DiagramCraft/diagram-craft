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
          input.body as Record<string, unknown>,
          authCtx,
          { id: auditUser.id, displayName: auditUser.display_name }
        );
      }
    )
  }
});

export const relationSyncOpenAPIHandler = new OpenAPIHandler(relationSyncORPCRouter, {
  clientInterceptors: orpcErrorInterceptors
});

export const createRelationSyncORPCHandler = (db: DatabaseAdapter) =>
  defineHandler(async event => {
    const result = await relationSyncOpenAPIHandler.handle(event.req, {
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
