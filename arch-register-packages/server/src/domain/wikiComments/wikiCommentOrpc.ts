import { defineHandler } from 'h3';
import { implement } from '@orpc/server';
import { OpenAPIHandler } from '@orpc/openapi/fetch';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { orpcErrorInterceptors, orpcErrorMiddleware } from '../../utils/orpcErrors';
import {
  createWikiComment,
  deleteWikiComment,
  listWikiComments,
  resolveWikiComment,
  updateWikiComment
} from './wikiCommentOperations';
import { wikiCommentContract } from '@arch-register/api-types/wikiCommentContract';

type ORPCContext = {
  db: DatabaseAdapter;
  event: AuthenticatedEvent;
};

const wikiCommentRouter = implement(wikiCommentContract)
  .$context<ORPCContext>()
  .use(orpcErrorMiddleware);

export const wikiCommentORPCRouter = wikiCommentRouter.router({
  wikiComments: {
    list: wikiCommentRouter.wikiComments.list.handler(async ({ input, context }) => {
      return await listWikiComments(
        context.db,
        input.params.workspace,
        input.query.nodeId,
        context.event
      );
    }),
    create: wikiCommentRouter.wikiComments.create.handler(async ({ input, context }) => {
      return await createWikiComment(
        context.db,
        input.params.workspace,
        input.body.nodeId,
        input.body,
        context.event
      );
    }),
    update: wikiCommentRouter.wikiComments.update.handler(async ({ input, context }) => {
      return await updateWikiComment(
        context.db,
        input.params.workspace,
        input.params.postId,
        input.body,
        context.event
      );
    }),
    resolve: wikiCommentRouter.wikiComments.resolve.handler(async ({ input, context }) => {
      return await resolveWikiComment(
        context.db,
        input.params.workspace,
        input.params.postId,
        input.body.resolved,
        context.event
      );
    }),
    remove: wikiCommentRouter.wikiComments.remove.handler(async ({ input, context }) => {
      return await deleteWikiComment(
        context.db,
        input.params.workspace,
        input.params.postId,
        context.event
      );
    })
  }
});

export const wikiCommentOpenAPIHandler = new OpenAPIHandler(wikiCommentORPCRouter, {
  clientInterceptors: orpcErrorInterceptors
});

export const createWikiCommentORPCHandler = (db: DatabaseAdapter) =>
  defineHandler(async event => {
    const result = await wikiCommentOpenAPIHandler.handle(event.req, {
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
