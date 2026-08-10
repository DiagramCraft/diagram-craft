import { implement } from '@orpc/server';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { createOrpcHandler } from '../../utils/orpcHandler';
import { orpcErrorMiddleware } from '../../utils/orpcErrors';
import {
  createWorkspaceEnum,
  deleteWorkspaceEnum,
  getWorkspaceEnum,
  listWorkspaceEnums,
  updateWorkspaceEnum
} from './enumOperations';
import { workspaceEnumContract } from '@arch-register/api-types/enumContract';

type ORPCContext = {
  db: DatabaseAdapter;
  event: AuthenticatedEvent;
};

const enumRouter = implement(workspaceEnumContract)
  .$context<ORPCContext>()
  .use(orpcErrorMiddleware);

export const workspaceEnumORPCRouter = enumRouter.router({
  enums: {
    list: enumRouter.enums.list.handler(async ({ input, context }) => {
      return await listWorkspaceEnums(context.db, input.params.workspace, context.event);
    }),
    get: enumRouter.enums.get.handler(async ({ input, context }) => {
      return await getWorkspaceEnum(
        context.db,
        input.params.workspace,
        input.params.id,
        context.event
      );
    }),
    create: enumRouter.enums.create.handler(async ({ input, context }) => {
      return await createWorkspaceEnum(
        context.db,
        input.params.workspace,
        input.body,
        context.event
      );
    }),
    update: enumRouter.enums.update.handler(async ({ input, context }) => {
      return await updateWorkspaceEnum(
        context.db,
        input.params.workspace,
        input.params.id,
        input.body,
        context.event
      );
    }),
    remove: enumRouter.enums.remove.handler(async ({ input, context }) => {
      return await deleteWorkspaceEnum(
        context.db,
        input.params.workspace,
        input.params.id,
        context.event
      );
    })
  }
});

export const createWorkspaceEnumORPCHandler = (db: DatabaseAdapter) =>
  createOrpcHandler(workspaceEnumORPCRouter, {
    context: event => ({ db, event: event as AuthenticatedEvent })
  });
