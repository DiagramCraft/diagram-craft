import { oc } from '@orpc/contract';
import { z } from 'zod';
import { ws, wsAndUUID } from '@arch-register/api-types/common';

export const categorySchema = z.object({
  id: z.string().describe('Unique category identifier'),
  workspaceId: z.string().describe('Parent workspace identifier'),
  name: z.string().describe('Category name'),
  createdAt: z.string().describe('ISO 8601 creation timestamp'),
  updatedAt: z.string().describe('ISO 8601 last update timestamp')
});

/** Embedded category reference returned inline on schemas, relation types, enums, and field groups. */
export const categoryRefSchema = z.object({
  id: z.string().describe('Category identifier'),
  name: z.string().describe('Category name')
});

const categoryBodySchema = z.object({
  name: z.string().describe('Category name')
});

const categorySuccessSchema = z.object({
  success: z.boolean().describe('Whether the operation succeeded'),
  message: z.string().describe('Status message')
});

export const workspaceCategoryContract = oc.tag('Categories').router({
  categories: {
    list: oc
      .route({
        method: 'GET',
        path: '/{workspace}/categories',
        inputStructure: 'detailed',
        summary: 'List categories',
        description:
          'Lists the workspace categories used to group schemas, relation types, enums, and field groups.',
        tags: ['Categories']
      })
      .input(z.object({ params: ws }))
      .output(z.array(categorySchema)),
    create: oc
      .route({
        method: 'POST',
        path: '/{workspace}/categories',
        inputStructure: 'detailed',
        summary: 'Create category',
        tags: ['Categories']
      })
      .input(z.object({ params: ws, body: categoryBodySchema }))
      .output(categorySchema),
    update: oc
      .route({
        method: 'PATCH',
        path: '/{workspace}/categories/{id}',
        inputStructure: 'detailed',
        summary: 'Rename category',
        tags: ['Categories']
      })
      .input(z.object({ params: wsAndUUID, body: categoryBodySchema }))
      .output(categorySchema),
    remove: oc
      .route({
        method: 'DELETE',
        path: '/{workspace}/categories/{id}',
        inputStructure: 'detailed',
        summary: 'Delete category',
        description: 'Deletes a category; fails if any schema, relation type, enum, or field group still uses it.',
        tags: ['Categories']
      })
      .input(z.object({ params: wsAndUUID }))
      .output(categorySuccessSchema)
  }
});

export type Category = z.infer<typeof categorySchema>;
export type CategoryRef = z.infer<typeof categoryRefSchema>;
export type CreateCategoryRequest = z.infer<typeof categoryBodySchema>;
