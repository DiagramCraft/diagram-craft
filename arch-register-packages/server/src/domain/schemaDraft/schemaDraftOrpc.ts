import { implement } from '@orpc/server';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { createOrpcHandler } from '../../utils/orpcHandler';
import { orpcErrorMiddleware } from '../../utils/orpcErrors';
import { workspaceSchemaDraftContract } from '@arch-register/api-types/schemaDraftContract';
import {
  discardSchemaDraft,
  getSchemaChangeMode,
  getSchemaDraft,
  reviewSchemaDraft,
  getSchemaDraftRecordReview,
  setSchemaChangeMode,
  stageSchemaDraftItem,
  unstageSchemaDraftItem
} from './schemaDraftOperations';
import {
  getSchemaPublication,
  listSchemaPublications,
  listSnapshotVersions,
  publishSchemaDraft,
  stageSchemaDraftFromVersion
} from './schemaDraftPublish';

type ORPCContext = {
  db: DatabaseAdapter;
  event: AuthenticatedEvent;
};

const draftRouter = implement(workspaceSchemaDraftContract)
  .$context<ORPCContext>()
  .use(orpcErrorMiddleware);

export const workspaceSchemaDraftORPCRouter = draftRouter.router({
  schemaDraft: {
    get: draftRouter.schemaDraft.get.handler(({ input, context }) =>
      getSchemaDraft(context.db, input.params.workspace, context.event)
    ),
    stage: draftRouter.schemaDraft.stage.handler(({ input, context }) =>
      stageSchemaDraftItem(
        context.db,
        input.params.workspace,
        input.params.kind,
        input.params.itemId,
        input.body,
        context.event
      )
    ),
    unstage: draftRouter.schemaDraft.unstage.handler(({ input, context }) =>
      unstageSchemaDraftItem(
        context.db,
        input.params.workspace,
        input.params.kind,
        input.params.itemId,
        input.query.expectedRevision,
        context.event
      )
    ),
    discard: draftRouter.schemaDraft.discard.handler(({ input, context }) =>
      discardSchemaDraft(
        context.db,
        input.params.workspace,
        input.query.expectedRevision,
        context.event
      )
    ),
    review: draftRouter.schemaDraft.review.handler(({ input, context }) =>
      reviewSchemaDraft(context.db, input.params.workspace, context.event)
    ),
    reviewRecords: draftRouter.schemaDraft.reviewRecords.handler(({ input, context }) =>
      getSchemaDraftRecordReview(
        context.db,
        input.params.workspace,
        input.params.jobRunId,
        context.event
      )
    ),
    publish: draftRouter.schemaDraft.publish.handler(({ input, context }) =>
      publishSchemaDraft(context.db, input.params.workspace, input.body, context.event)
    ),
    fromVersion: draftRouter.schemaDraft.fromVersion.handler(({ input, context }) =>
      stageSchemaDraftFromVersion(context.db, input.params.workspace, input.body, context.event)
    ),
    getMode: draftRouter.schemaDraft.getMode.handler(({ input, context }) =>
      getSchemaChangeMode(context.db, input.params.workspace, context.event)
    ),
    setMode: draftRouter.schemaDraft.setMode.handler(({ input, context }) =>
      setSchemaChangeMode(
        context.db,
        input.params.workspace,
        input.body.schemaChangeMode,
        context.event
      )
    )
  },
  schemaPublication: {
    list: draftRouter.schemaPublication.list.handler(({ input, context }) =>
      listSchemaPublications(context.db, input.params.workspace, context.event)
    ),
    get: draftRouter.schemaPublication.get.handler(({ input, context }) =>
      getSchemaPublication(context.db, input.params.workspace, input.params.number, context.event)
    )
  },
  schemaSnapshotVersion: {
    list: draftRouter.schemaSnapshotVersion.list.handler(({ input, context }) =>
      listSnapshotVersions(
        context.db,
        input.params.workspace,
        input.params.kind,
        input.params.itemId,
        context.event
      )
    )
  }
});

export const createWorkspaceSchemaDraftORPCHandler = (db: DatabaseAdapter) =>
  createOrpcHandler(workspaceSchemaDraftORPCRouter, {
    context: event => ({ db, event: event as AuthenticatedEvent })
  });
