import { implement } from '@orpc/server';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { createOrpcHandler } from '../../utils/orpcHandler';
import { orpcErrorMiddleware } from '../../utils/orpcErrors';
import {
  listWorkspaceRelationSchemas,
  getWorkspaceRelationSchema,
  createWorkspaceRelationSchema,
  updateWorkspaceRelationSchema,
  deleteWorkspaceRelationSchema,
  listWorkspaceRelationSchemaVersions
} from './relationSchemaOperations';
import { workspaceRelationSchemaContract } from '@arch-register/api-types/relationSchemaContract';

type ORPCContext = {
  db: DatabaseAdapter;
  event: AuthenticatedEvent;
};

const relationSchemaRouter = implement(workspaceRelationSchemaContract)
  .$context<ORPCContext>()
  .use(orpcErrorMiddleware);

export const workspaceRelationSchemaORPCRouter = relationSchemaRouter.router({
  relationSchemas: {
    list: relationSchemaRouter.relationSchemas.list.handler(async ({ input, context }) => {
      return await listWorkspaceRelationSchemas(context.db, input.params.workspace, context.event);
    }),
    get: relationSchemaRouter.relationSchemas.get.handler(async ({ input, context }) => {
      return await getWorkspaceRelationSchema(
        context.db,
        input.params.workspace,
        input.params.id,
        context.event
      );
    }),
    create: relationSchemaRouter.relationSchemas.create.handler(async ({ input, context }) => {
      return await createWorkspaceRelationSchema(
        context.db,
        input.params.workspace,
        input.body,
        context.event
      );
    }),
    update: relationSchemaRouter.relationSchemas.update.handler(async ({ input, context }) => {
      return await updateWorkspaceRelationSchema(
        context.db,
        input.params.workspace,
        input.params.id,
        input.body,
        context.event
      );
    }),
    remove: relationSchemaRouter.relationSchemas.remove.handler(async ({ input, context }) => {
      return await deleteWorkspaceRelationSchema(
        context.db,
        input.params.workspace,
        input.params.id,
        context.event
      );
    }),
    listVersions: relationSchemaRouter.relationSchemas.listVersions.handler(
      async ({ input, context }) => {
        return await listWorkspaceRelationSchemaVersions(
          context.db,
          input.params.workspace,
          input.params.id,
          context.event
        );
      }
    )
  }
});

export const createWorkspaceRelationSchemaORPCHandler = (db: DatabaseAdapter) =>
  createOrpcHandler(workspaceRelationSchemaORPCRouter, {
    context: event => ({ db, event: event as AuthenticatedEvent })
  });
