import { implement } from '@orpc/server';
import { workspaceEntityTraversalContract } from '@arch-register/api-types/entityTraversalContract';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { createOrpcHandler } from '../../utils/orpcHandler';
import { entityScoped, orpcErrorMiddleware, workspaceScoped } from '../../utils/orpcErrors';
import { executeSubjectTraversal } from './entityTraversalOperations';
import { diffSubjectTraversal } from './entityTraversalGraphDiffOperations';

type ORPCContext = {
  db: DatabaseAdapter;
  event: AuthenticatedEvent;
};

const entityTraversalRouter = implement(workspaceEntityTraversalContract)
  .$context<ORPCContext>()
  .use(orpcErrorMiddleware)
  .use(workspaceScoped)
  .use(entityScoped);

const entityTraversalHandlers = {
  traverse: entityTraversalRouter.entityTraversal.traverse.handler(async ({ input, context }) => {
    const { workspace, authCtx } = context;
    const { subject, paths, maxDepth, maxNodes } = input.body;
    return executeSubjectTraversal(context.db, workspace, authCtx, {
      subject,
      paths,
      maxDepth,
      maxNodes
    });
  }),
  diff: entityTraversalRouter.entityTraversal.diff.handler(async ({ input, context }) => {
    const { workspace, authCtx } = context;
    return diffSubjectTraversal(context.db, workspace, authCtx, input.body);
  })
};

export const workspaceEntityTraversalORPCRouter = entityTraversalRouter.router({
  entityTraversal: entityTraversalHandlers
});

export const createWorkspaceEntityTraversalORPCHandler = (db: DatabaseAdapter) =>
  createOrpcHandler(workspaceEntityTraversalORPCRouter, {
    context: event => ({ db, event: event as AuthenticatedEvent })
  });
