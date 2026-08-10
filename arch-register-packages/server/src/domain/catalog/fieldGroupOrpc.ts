import { implement } from '@orpc/server';
import { workspaceFieldGroupContract } from '@arch-register/api-types/fieldGroupContract';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { createOrpcHandler } from '../../utils/orpcHandler';
import { orpcErrorMiddleware } from '../../utils/orpcErrors';
import {
  createWorkspaceSharedFieldGroup,
  deleteWorkspaceSharedFieldGroup,
  getWorkspaceSharedFieldGroup,
  listWorkspaceSharedFieldGroups,
  updateWorkspaceSharedFieldGroup
} from './fieldGroupOperations';

type ORPCContext = { db: DatabaseAdapter; event: AuthenticatedEvent };
const router = implement(workspaceFieldGroupContract)
  .$context<ORPCContext>()
  .use(orpcErrorMiddleware);

export const workspaceFieldGroupORPCRouter = router.router({
  fieldGroups: {
    list: router.fieldGroups.list.handler(({ input, context }) =>
      listWorkspaceSharedFieldGroups(context.db, input.params.workspace, context.event)
    ),
    get: router.fieldGroups.get.handler(({ input, context }) =>
      getWorkspaceSharedFieldGroup(
        context.db,
        input.params.workspace,
        input.params.id,
        context.event
      )
    ),
    create: router.fieldGroups.create.handler(({ input, context }) =>
      createWorkspaceSharedFieldGroup(context.db, input.params.workspace, input.body, context.event)
    ),
    update: router.fieldGroups.update.handler(({ input, context }) =>
      updateWorkspaceSharedFieldGroup(
        context.db,
        input.params.workspace,
        input.params.id,
        input.body,
        context.event
      )
    ),
    remove: router.fieldGroups.remove.handler(({ input, context }) =>
      deleteWorkspaceSharedFieldGroup(
        context.db,
        input.params.workspace,
        input.params.id,
        context.event
      )
    )
  }
});

export const createWorkspaceFieldGroupORPCHandler = (db: DatabaseAdapter) =>
  createOrpcHandler(workspaceFieldGroupORPCRouter, {
    context: event => ({ db, event: event as AuthenticatedEvent })
  });
