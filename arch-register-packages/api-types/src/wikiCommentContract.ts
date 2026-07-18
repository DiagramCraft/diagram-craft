import { oc } from '@orpc/contract';
import { z } from 'zod';
import { ws } from '@arch-register/api-types/common';

const wsAndPostId = ws.extend({
  postId: z.string().describe('Wiki inline comment identifier')
});

const wikiCommentListQuerySchema = z.object({
  nodeId: z.string().describe('Content node (wiki page) identifier')
});

const textAnchorSchema = z.object({
  quote: z.string().describe('The exact text this comment is attached to'),
  prefix: z.string().describe('Short context snippet immediately before the quote'),
  suffix: z.string().describe('Short context snippet immediately after the quote'),
  start: z.number().int().min(0).describe('Character offset of the quote start, at creation time'),
  end: z.number().int().min(0).describe('Character offset of the quote end, at creation time')
});

const wikiCommentSchema = z.object({
  id: z.string().describe('Unique comment identifier'),
  workspace: z.string().describe('Parent workspace identifier'),
  nodeId: z.string().describe('Content node (wiki page) identifier'),
  parentPostId: z
    .string()
    .nullable()
    .describe('Root comment this is a reply to, or null for a root comment'),
  authorId: z.string().nullable().describe('Author user id, or null if the author was deleted'),
  authorName: z.string().describe('Author display name at read time'),
  body: z.string().describe('Comment body (plain text)'),
  anchor: textAnchorSchema.describe(
    'Text anchor as stored at creation time (replies echo their root comment’s anchor)'
  ),
  resolvedAt: z.string().nullable().describe('ISO 8601 timestamp the thread was resolved, or null'),
  resolvedBy: z.string().nullable().describe('User id who resolved the thread, or null'),
  createdAt: z.string().describe('ISO 8601 creation timestamp'),
  updatedAt: z.string().describe('ISO 8601 last update timestamp'),
  editedAt: z
    .string()
    .nullable()
    .describe('ISO 8601 timestamp of the last body edit, or null if never edited')
});

const createWikiCommentBodySchema = z.object({
  nodeId: z.string().describe('Content node (wiki page) identifier'),
  parentPostId: z.string().optional().describe('Root comment this is a reply to, if any'),
  body: z.string().min(1).describe('Comment body (plain text)'),
  anchor: textAnchorSchema
    .optional()
    .describe('Required for root comments; omitted for replies, which inherit the root’s anchor')
});

const updateWikiCommentBodySchema = z.object({
  body: z.string().min(1).describe('New comment body (plain text)')
});

const resolveWikiCommentBodySchema = z.object({
  resolved: z.boolean().describe('Whether to mark the thread resolved or unresolved')
});

export const wikiCommentContract = oc.tag('WikiComments').router({
  wikiComments: {
    list: oc
      .route({
        method: 'GET',
        path: '/{workspace}/wiki-comments',
        inputStructure: 'detailed',
        summary: 'List inline comments for a wiki page',
        description: 'Retrieves every inline comment thread anchored to a single wiki page.',
        tags: ['WikiComments']
      })
      .input(z.object({ params: ws, query: wikiCommentListQuerySchema }))
      .output(z.array(wikiCommentSchema)),
    create: oc
      .route({
        method: 'POST',
        path: '/{workspace}/wiki-comments',
        inputStructure: 'detailed',
        summary: 'Create an inline wiki comment',
        description: 'Creates a new root comment (with an anchor) or a reply to a root comment.',
        tags: ['WikiComments']
      })
      .input(z.object({ params: ws, body: createWikiCommentBodySchema }))
      .output(wikiCommentSchema),
    update: oc
      .route({
        method: 'PATCH',
        path: '/{workspace}/wiki-comments/{postId}',
        inputStructure: 'detailed',
        summary: 'Edit an inline wiki comment',
        description:
          'Updates the body of a comment. Only the original author may edit their own comment.',
        tags: ['WikiComments']
      })
      .input(z.object({ params: wsAndPostId, body: updateWikiCommentBodySchema }))
      .output(wikiCommentSchema),
    resolve: oc
      .route({
        method: 'PATCH',
        path: '/{workspace}/wiki-comments/{postId}/resolve',
        inputStructure: 'detailed',
        summary: 'Resolve or unresolve an inline wiki comment thread',
        description: 'Sets or clears the resolved state of a root comment thread.',
        tags: ['WikiComments']
      })
      .input(z.object({ params: wsAndPostId, body: resolveWikiCommentBodySchema }))
      .output(wikiCommentSchema),
    remove: oc
      .route({
        method: 'DELETE',
        path: '/{workspace}/wiki-comments/{postId}',
        inputStructure: 'detailed',
        summary: 'Delete an inline wiki comment',
        description:
          'Permanently deletes a comment and its replies. Only the original author may delete their own comment.',
        tags: ['WikiComments']
      })
      .input(z.object({ params: wsAndPostId }))
      .output(
        z.object({
          success: z.boolean().describe('Whether the deletion was successful'),
          message: z.string().describe('Status message or error details')
        })
      )
  }
});

export type WikiCommentTextAnchor = z.infer<typeof textAnchorSchema>;
export type WikiComment = z.infer<typeof wikiCommentSchema>;
export type CreateWikiCommentRequest = z.infer<typeof createWikiCommentBodySchema>;
export type UpdateWikiCommentRequest = z.infer<typeof updateWikiCommentBodySchema>;
export type ResolveWikiCommentRequest = z.infer<typeof resolveWikiCommentBodySchema>;
