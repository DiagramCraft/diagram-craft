import { implement } from '@orpc/server';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { createOrpcHandler } from '../../utils/orpcHandler';
import { orpcErrorMiddleware } from '../../utils/orpcErrors';
import { workspaceCategoryContract } from '@arch-register/api-types/categoryContract';
import { createCategory, deleteCategory, listCategories, updateCategory } from './categoryOperations';

type ORPCContext = { db: DatabaseAdapter; event: AuthenticatedEvent };

const categoryRouter = implement(workspaceCategoryContract)
  .$context<ORPCContext>()
  .use(orpcErrorMiddleware);

export const workspaceCategoryORPCRouter = categoryRouter.router({
  categories: {
    list: categoryRouter.categories.list.handler(async ({ input, context }) => {
      return await listCategories(context.db, input.params.workspace, context.event);
    }),
    create: categoryRouter.categories.create.handler(async ({ input, context }) => {
      return await createCategory(
        context.db,
        input.params.workspace,
        context.event,
        input.body.name
      );
    }),
    update: categoryRouter.categories.update.handler(async ({ input, context }) => {
      return await updateCategory(
        context.db,
        input.params.workspace,
        input.params.id,
        context.event,
        input.body.name
      );
    }),
    remove: categoryRouter.categories.remove.handler(async ({ input, context }) => {
      return await deleteCategory(
        context.db,
        input.params.workspace,
        input.params.id,
        context.event
      );
    })
  }
});

export const createWorkspaceCategoryORPCHandler = (db: DatabaseAdapter) =>
  createOrpcHandler(workspaceCategoryORPCRouter, {
    context: event => ({ db, event: event as AuthenticatedEvent })
  });
