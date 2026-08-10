import { implement } from '@orpc/server';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { artifactContract } from '@arch-register/api-types/artifactContract';
import { buildApiEntityAuthCtx } from '../auth/authorization';
import { createOrpcHandler } from '../../utils/orpcHandler';
import { API_PREFIXES } from '../../constants';
import { orpcErrorMiddleware } from '../../utils/orpcErrors';
import { requestForApiSurface } from '../../utils/apiRouteAliases';
import { resolveWorkspace } from '../workspace/resolveWorkspace';
import {
  createArtifact,
  createArtifactRevision,
  getArtifactRevisionContent,
  listArtifacts,
  updateArtifact
} from './artifactOperations';

type ORPCContext = { db: DatabaseAdapter; event: AuthenticatedEvent };

const router = implement(artifactContract).$context<ORPCContext>().use(orpcErrorMiddleware);

const getContext = async (
  db: DatabaseAdapter,
  event: AuthenticatedEvent,
  workspaceSlug: string
) => {
  const workspace = await resolveWorkspace(db.catalog, workspaceSlug);
  return { workspace, authCtx: await buildApiEntityAuthCtx(db, workspace, event) };
};

export const artifactORPCRouter = router.router({
  artifacts: {
    list: router.artifacts.list.handler(async ({ input, context }) => {
      const { workspace, authCtx } = await getContext(
        context.db,
        context.event,
        input.params.workspace
      );
      return listArtifacts(context.db, workspace, input.params.entityId, authCtx);
    }),
    create: router.artifacts.create.handler(async ({ input, context }) => {
      const { workspace, authCtx } = await getContext(
        context.db,
        context.event,
        input.params.workspace
      );
      return createArtifact(context.db, workspace, input.params.entityId, input.body, authCtx);
    }),
    update: router.artifacts.update.handler(async ({ input, context }) => {
      const { workspace, authCtx } = await getContext(
        context.db,
        context.event,
        input.params.workspace
      );
      return updateArtifact(
        context.db,
        workspace,
        input.params.entityId,
        input.params.artifactId,
        input.body,
        authCtx
      );
    }),
    createRevision: router.artifacts.createRevision.handler(async ({ input, context }) => {
      const { workspace, authCtx } = await getContext(
        context.db,
        context.event,
        input.params.workspace
      );
      return createArtifactRevision(
        context.db,
        workspace,
        input.params.entityId,
        input.params.artifactId,
        input.body,
        authCtx
      );
    }),
    getRevisionContent: router.artifacts.getRevisionContent.handler(async ({ input, context }) => {
      const { workspace, authCtx } = await getContext(
        context.db,
        context.event,
        input.params.workspace
      );
      return getArtifactRevisionContent(
        context.db,
        workspace,
        input.params.entityId,
        input.params.artifactId,
        input.params.revisionId,
        authCtx
      );
    })
  }
});

export const createArtifactORPCHandler = (db: DatabaseAdapter) =>
  createOrpcHandler(artifactORPCRouter, {
    prefix: API_PREFIXES.root,
    shouldHandle: event =>
      new RegExp(`^${API_PREFIXES.application}/[^/]+/entities/[^/]+/artifacts(?:/.*)?$`).test(
        new URL(event.req.url).pathname
      ),
    request: event => requestForApiSurface(event, API_PREFIXES.application, API_PREFIXES.root),
    context: event => ({ db, event: event as AuthenticatedEvent })
  });
