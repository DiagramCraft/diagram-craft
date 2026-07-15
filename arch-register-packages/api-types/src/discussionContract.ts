import { oc } from '@orpc/contract';
import { z } from 'zod';
import { ws } from '@arch-register/api-types/common';

const discussionObjectTypeSchema = z
  .enum(['content_node', 'assessment', 'entity'])
  .describe('Kind of object a discussion thread is attached to');

const wsAndPostId = ws.extend({
  postId: z.string().describe('Discussion post identifier')
});

const discussionObjectQuerySchema = z.object({
  objectType: discussionObjectTypeSchema,
  objectId: z.string().describe('Identifier of the object the thread is attached to')
});

const discussionPostSchema = z.object({
  id: z.string().describe('Unique post identifier'),
  workspace: z.string().describe('Parent workspace identifier'),
  objectType: discussionObjectTypeSchema,
  objectId: z.string().describe('Identifier of the object the thread is attached to'),
  parentPostId: z
    .string()
    .nullable()
    .describe('Root post this is a reply to, or null for a root post'),
  authorId: z.string().nullable().describe('Author user id, or null if the author was deleted'),
  authorName: z.string().describe('Author display name at read time'),
  body: z.string().describe('Post body (plain text)'),
  createdAt: z.string().describe('ISO 8601 creation timestamp'),
  updatedAt: z.string().describe('ISO 8601 last update timestamp'),
  editedAt: z
    .string()
    .nullable()
    .describe('ISO 8601 timestamp of the last body edit, or null if never edited')
});

const createDiscussionPostBodySchema = z.object({
  objectType: discussionObjectTypeSchema,
  objectId: z.string().describe('Identifier of the object the thread is attached to'),
  parentPostId: z.string().optional().describe('Root post this is a reply to, if any'),
  body: z.string().min(1).describe('Post body (plain text)')
});

const updateDiscussionPostBodySchema = z.object({
  body: z.string().min(1).describe('New post body (plain text)')
});

const discussionSummaryEntrySchema = z.object({
  objectType: discussionObjectTypeSchema,
  objectId: z.string(),
  objectTitle: z.string().describe('Display title of the object the thread is attached to'),
  postCount: z.number().int().min(0),
  lastPost: discussionPostSchema,
  nav: z
    .discriminatedUnion('type', [
      z.object({ type: z.literal('entity'), entityPublicId: z.string() }),
      z.object({ type: z.literal('assessment'), projectPublicId: z.string() }),
      z.object({
        type: z.literal('content_node'),
        projectPublicId: z.string().optional(),
        entityPublicId: z.string().optional()
      })
    ])
    .describe('Enough information for a client to build a link to the owning object')
});

export const discussionContract = oc.tag('Discussions').router({
  discussions: {
    list: oc
      .route({
        method: 'GET',
        path: '/{workspace}/discussions',
        inputStructure: 'detailed',
        summary: 'List discussion posts for an object',
        description: 'Retrieves every post in the discussion thread attached to a single object.',
        tags: ['Discussions']
      })
      .input(z.object({ params: ws, query: discussionObjectQuerySchema }))
      .output(z.array(discussionPostSchema)),
    summary: oc
      .route({
        method: 'GET',
        path: '/{workspace}/discussions/summary',
        inputStructure: 'detailed',
        summary: 'Summarize discussion activity across the workspace',
        description:
          'Retrieves per-object post counts and the most recent post, for the global discussions aggregator.',
        tags: ['Discussions']
      })
      .input(z.object({ params: ws }))
      .output(z.array(discussionSummaryEntrySchema)),
    create: oc
      .route({
        method: 'POST',
        path: '/{workspace}/discussions',
        inputStructure: 'detailed',
        summary: 'Create a discussion post',
        description: 'Creates a new root post or reply on an object’s discussion thread.',
        tags: ['Discussions']
      })
      .input(z.object({ params: ws, body: createDiscussionPostBodySchema }))
      .output(discussionPostSchema),
    update: oc
      .route({
        method: 'PATCH',
        path: '/{workspace}/discussions/{postId}',
        inputStructure: 'detailed',
        summary: 'Edit a discussion post',
        description:
          'Updates the body of a post. Only the original author may edit their own post.',
        tags: ['Discussions']
      })
      .input(z.object({ params: wsAndPostId, body: updateDiscussionPostBodySchema }))
      .output(discussionPostSchema),
    remove: oc
      .route({
        method: 'DELETE',
        path: '/{workspace}/discussions/{postId}',
        inputStructure: 'detailed',
        summary: 'Delete a discussion post',
        description:
          'Permanently deletes a post and its replies. Only the original author may delete their own post.',
        tags: ['Discussions']
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

export type DiscussionObjectType = z.infer<typeof discussionObjectTypeSchema>;
export type DiscussionPost = z.infer<typeof discussionPostSchema>;
export type DiscussionSummaryEntry = z.infer<typeof discussionSummaryEntrySchema>;
export type CreateDiscussionPostRequest = z.infer<typeof createDiscussionPostBodySchema>;
export type UpdateDiscussionPostRequest = z.infer<typeof updateDiscussionPostBodySchema>;
