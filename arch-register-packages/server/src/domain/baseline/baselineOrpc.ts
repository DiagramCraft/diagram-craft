import { implement } from '@orpc/server';
import type { AuthorizationContext } from '@arch-register/permissions';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { createOrpcHandler } from '../../utils/orpcHandler';
import { entityScoped, orpcErrorMiddleware, workspaceScoped } from '../../utils/orpcErrors';
import { baselineContract } from '@arch-register/api-types/baselineContract';
import {
  compareBaselines,
  createBaseline,
  deleteBaseline,
  exportBaseline,
  getBaselineDetail,
  listBaselineLinks,
  listBaselines,
  createBaselineLink,
  deleteBaselineLink,
  supersedeBaseline
} from './baselineOperations';

type ORPCContext = {
  db: DatabaseAdapter;
  event: AuthenticatedEvent;
};

const baselineRouter = implement(baselineContract)
  .$context<ORPCContext>()
  .use(orpcErrorMiddleware)
  .use(workspaceScoped)
  .use(entityScoped);

export const baselineORPCRouter = baselineRouter.router({
  baselines: {
    list: baselineRouter.baselines.list.handler(async ({ input, context }) =>
      listBaselines(
        context.db,
        context.workspace,
        context.authCtx as AuthorizationContext,
        input.query?.includeDeleted ?? false
      )
    ),
    create: baselineRouter.baselines.create.handler(async ({ input, context }) =>
      createBaseline(
        context.db,
        context.workspace,
        context.authCtx as AuthorizationContext,
        input.body,
        context.event.context.user.id
      )
    ),
    get: baselineRouter.baselines.get.handler(async ({ input, context }) =>
      getBaselineDetail(
        context.db,
        context.workspace,
        context.authCtx as AuthorizationContext,
        input.params.id
      )
    ),
    diff: baselineRouter.baselines.diff.handler(async ({ input, context }) =>
      compareBaselines(
        context.db,
        context.workspace,
        context.authCtx as AuthorizationContext,
        input.body.from,
        input.body.to
      )
    ),
    supersede: baselineRouter.baselines.supersede.handler(async ({ input, context }) =>
      supersedeBaseline(
        context.db,
        context.workspace,
        context.authCtx as AuthorizationContext,
        input.params.id,
        input.body.replacementId,
        context.event.context.user.id
      )
    ),
    remove: baselineRouter.baselines.remove.handler(async ({ input, context }) =>
      deleteBaseline(
        context.db,
        context.workspace,
        context.authCtx as AuthorizationContext,
        input.params.id,
        context.event.context.user.id
      )
    ),
    export: baselineRouter.baselines.export.handler(async ({ input, context }) =>
      exportBaseline(
        context.db,
        context.workspace,
        context.authCtx as AuthorizationContext,
        input.params.id
      )
    ),
    links: {
      list: baselineRouter.baselines.links.list.handler(async ({ input, context }) =>
        listBaselineLinks(
          context.db,
          context.workspace,
          context.authCtx as AuthorizationContext,
          input.params.id
        )
      ),
      create: baselineRouter.baselines.links.create.handler(async ({ input, context }) =>
        createBaselineLink(
          context.db,
          context.workspace,
          context.authCtx as AuthorizationContext,
          input.params.id,
          input.body.targetType,
          input.body.targetId,
          context.event.context.user.id
        )
      ),
      remove: baselineRouter.baselines.links.remove.handler(async ({ input, context }) =>
        deleteBaselineLink(
          context.db,
          context.workspace,
          context.authCtx as AuthorizationContext,
          input.params.id,
          input.params.linkId,
          context.event.context.user.id
        )
      )
    }
  }
});

export const createBaselineORPCHandler = (db: DatabaseAdapter) =>
  createOrpcHandler(baselineORPCRouter, {
    context: event => ({ db, event: event as AuthenticatedEvent })
  });
