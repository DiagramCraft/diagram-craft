import { implement } from '@orpc/server';
import { externalContentContract } from '@arch-register/api-types/externalContentContract';
import type { DatabaseAdapter } from '../../db/database';
import type { StorageAdapter } from '../../storage/storage';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { createOrpcHandler } from '../../utils/orpcHandler';
import {
  createExternalContentMount,
  listExternalContentMounts,
  removeExternalContentMount,
  syncExternalContentMount,
  updateExternalContentMount
} from './externalContentOperations';
import { orpcErrorMiddleware } from '../../utils/orpcErrors';

type Context = { db: DatabaseAdapter; storage: StorageAdapter; event: AuthenticatedEvent };
const router = implement(externalContentContract).$context<Context>().use(orpcErrorMiddleware);

const externalContentRouter = router.router({
  externalContent: {
    list: router.externalContent.list.handler(({ input, context }) =>
      listExternalContentMounts(context.db, input.params.workspace, context.event)
    ),
    create: router.externalContent.create.handler(({ input, context }) =>
      createExternalContentMount(context.db, input.params.workspace, input.body, context.event)
    ),
    update: router.externalContent.update.handler(({ input, context }) =>
      updateExternalContentMount(
        context.db,
        input.params.workspace,
        input.params.id,
        input.body,
        context.event
      )
    ),
    remove: router.externalContent.remove.handler(({ input, context }) =>
      removeExternalContentMount(
        context.db,
        context.storage,
        input.params.workspace,
        input.params.id,
        context.event
      )
    ),
    sync: router.externalContent.sync.handler(({ input, context }) =>
      syncExternalContentMount(context.db, input.params.workspace, input.params.id, context.event)
    )
  }
});

export const createExternalContentORPCHandler = (db: DatabaseAdapter, storage: StorageAdapter) =>
  createOrpcHandler(externalContentRouter, {
    context: event => ({ db, storage, event: event as AuthenticatedEvent })
  });
