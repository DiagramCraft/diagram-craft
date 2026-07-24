import { oc } from '@orpc/contract';
import { z } from 'zod';
import { ws, wsAndUUID, UUID_REGEX } from '@arch-register/api-types/common';

const collectionEntityParams = z.object({
  workspace: z.string(),
  id: z.string().regex(UUID_REGEX),
  entityId: z.string()
});

export const collectionSchema = z.object({
  id: z.string().describe('Unique collection identifier'),
  workspaceId: z.string().describe('Parent workspace identifier'),
  name: z.string().describe('Collection name'),
  entityCount: z.number().int().min(0).describe('Number of entities in the collection'),
  isMember: z
    .boolean()
    .optional()
    .describe('Whether the requested entity belongs to the collection'),
  createdAt: z.string().describe('ISO 8601 creation timestamp'),
  updatedAt: z.string().describe('ISO 8601 last update timestamp')
});

const collectionBodySchema = z.object({
  name: z.string().describe('Collection name')
});

const collectionSuccessSchema = z.object({
  success: z.boolean().describe('Whether the operation succeeded'),
  message: z.string().describe('Status message')
});

export const workspaceCollectionContract = oc.tag('Collections').router({
  collections: {
    list: oc
      .route({
        method: 'GET',
        path: '/{workspace}/collections',
        inputStructure: 'detailed',
        summary: 'List personal collections',
        description: "Lists the current user's personal entity collections in the workspace.",
        tags: ['Collections']
      })
      .input(
        z.object({
          params: ws,
          query: z
            .object({
              entityId: z
                .string()
                .regex(UUID_REGEX)
                .optional()
                .describe('Entity identifier used to report membership')
            })
            .optional()
        })
      )
      .output(z.array(collectionSchema)),
    create: oc
      .route({
        method: 'POST',
        path: '/{workspace}/collections',
        inputStructure: 'detailed',
        summary: 'Create personal collection',
        tags: ['Collections']
      })
      .input(z.object({ params: ws, body: collectionBodySchema }))
      .output(collectionSchema),
    update: oc
      .route({
        method: 'PATCH',
        path: '/{workspace}/collections/{id}',
        inputStructure: 'detailed',
        summary: 'Rename personal collection',
        tags: ['Collections']
      })
      .input(z.object({ params: wsAndUUID, body: collectionBodySchema }))
      .output(collectionSchema),
    remove: oc
      .route({
        method: 'DELETE',
        path: '/{workspace}/collections/{id}',
        inputStructure: 'detailed',
        summary: 'Delete personal collection',
        tags: ['Collections']
      })
      .input(z.object({ params: wsAndUUID }))
      .output(collectionSuccessSchema),
    addEntity: oc
      .route({
        method: 'POST',
        path: '/{workspace}/collections/{id}/entities',
        inputStructure: 'detailed',
        summary: 'Add entity to collection',
        tags: ['Collections']
      })
      .input(
        z.object({
          params: wsAndUUID,
          body: z.object({ entity_id: z.string().describe('Entity identifier to add') })
        })
      )
      .output(collectionSuccessSchema),
    removeEntity: oc
      .route({
        method: 'DELETE',
        path: '/{workspace}/collections/{id}/entities/{entityId}',
        inputStructure: 'detailed',
        summary: 'Remove entity from collection',
        tags: ['Collections']
      })
      .input(z.object({ params: collectionEntityParams }))
      .output(collectionSuccessSchema)
  }
});

export type Collection = z.infer<typeof collectionSchema>;
export type CreateCollectionRequest = z.infer<typeof collectionBodySchema>;
