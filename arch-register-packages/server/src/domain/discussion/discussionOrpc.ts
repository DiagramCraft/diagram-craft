import { defineHandler } from 'h3';
import { implement } from '@orpc/server';
import { OpenAPIHandler } from '@orpc/openapi/fetch';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { orpcErrorInterceptors, orpcErrorMiddleware } from '../../utils/orpcErrors';
import {
  createDiscussionPost,
  deleteDiscussionPost,
  listDiscussionPosts,
  summarizeDiscussions,
  updateDiscussionPost
} from './discussionOperations';
import { discussionContract } from '@arch-register/api-types/discussionContract';

type ORPCContext = {
  db: DatabaseAdapter;
  event: AuthenticatedEvent;
};

const discussionRouter = implement(discussionContract)
  .$context<ORPCContext>()
  .use(orpcErrorMiddleware);

export const discussionORPCRouter = discussionRouter.router({
  discussions: {
    list: discussionRouter.discussions.list.handler(async ({ input, context }) => {
      return await listDiscussionPosts(
        context.db,
        input.params.workspace,
        input.query.objectType,
        input.query.objectId,
        context.event
      );
    }),
    summary: discussionRouter.discussions.summary.handler(async ({ input, context }) => {
      return await summarizeDiscussions(context.db, input.params.workspace, context.event);
    }),
    create: discussionRouter.discussions.create.handler(async ({ input, context }) => {
      return await createDiscussionPost(
        context.db,
        input.params.workspace,
        input.body,
        context.event
      );
    }),
    update: discussionRouter.discussions.update.handler(async ({ input, context }) => {
      return await updateDiscussionPost(
        context.db,
        input.params.workspace,
        input.params.postId,
        input.body,
        context.event
      );
    }),
    remove: discussionRouter.discussions.remove.handler(async ({ input, context }) => {
      return await deleteDiscussionPost(
        context.db,
        input.params.workspace,
        input.params.postId,
        context.event
      );
    })
  }
});

export const discussionOpenAPIHandler = new OpenAPIHandler(discussionORPCRouter, {
  clientInterceptors: orpcErrorInterceptors
});

export const createDiscussionORPCHandler = (db: DatabaseAdapter) =>
  defineHandler(async event => {
    const result = await discussionOpenAPIHandler.handle(event.req, {
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
