import { oc } from '@orpc/contract';
import { z } from 'zod';
import { ws, wsAndUUID } from '@arch-register/api-types/common';

const enumOptionSchema = z.object({
  value: z.string().describe('Internal option value used in data storage'),
  label: z.string().describe('Display label for the option')
});

const workspaceEnumSchema = z.object({
  id: z.string().describe('Unique enumeration identifier (UUID)'),
  workspace: z.string().describe('Parent workspace identifier'),
  name: z.string().describe('Enumeration name (must be unique within workspace)'),
  options: z.array(enumOptionSchema).describe('Available enumeration options'),
  sort_order: z.number().int().min(0).describe('Display order (0-based)'),
  created_at: z.string().describe('ISO 8601 creation timestamp'),
  updated_at: z.string().describe('ISO 8601 last update timestamp')
});

const createEnumBodySchema = z.object({
  name: z.string().describe('Enumeration name (must be unique within workspace)'),
  options: z.preprocess(
    value => (Array.isArray(value) ? value : undefined),
    z.array(enumOptionSchema).optional().describe('Initial enumeration options (can be empty)')
  ),
  sort_order: z.preprocess(
    value => (typeof value === 'number' ? value : undefined),
    z.number().int().min(0).optional().describe('Display order (defaults to end of list)')
  )
});

export const workspaceEnumContract = oc.tag('Enums').router({
  enums: {
    list: oc
      .route({
        method: 'GET',
        path: '/{workspace}/enums',
        inputStructure: 'detailed',
        summary: 'List workspace enumerations',
        description:
          'Retrieves all custom enumeration definitions for the workspace. Enumerations are used to define dropdown options for entity properties.',
        tags: ['Enums']
      })
      .input(z.object({ params: ws }))
      .output(z.array(workspaceEnumSchema)),
    get: oc
      .route({
        method: 'GET',
        path: '/{workspace}/enums/{id}',
        inputStructure: 'detailed',
        summary: 'Get enumeration details',
        description:
          'Retrieves a specific enumeration definition by ID, including all its options.',
        tags: ['Enums']
      })
      .input(
        z.object({
          params: wsAndUUID
        })
      )
      .output(workspaceEnumSchema),
    create: oc
      .route({
        method: 'POST',
        path: '/{workspace}/enums',
        inputStructure: 'detailed',
        summary: 'Create new enumeration',
        description:
          'Creates a new enumeration definition with the specified options. The enumeration can then be used in entity schema properties.',
        tags: ['Enums']
      })
      .input(
        z.object({
          params: ws,
          body: createEnumBodySchema
        })
      )
      .output(workspaceEnumSchema),
    update: oc
      .route({
        method: 'PUT',
        path: '/{workspace}/enums/{id}',
        inputStructure: 'detailed',
        summary: 'Update enumeration',
        description:
          'Updates an existing enumeration definition. Changes to options will affect all entities using this enumeration.',
        tags: ['Enums']
      })
      .input(
        z.object({
          params: wsAndUUID,
          body: createEnumBodySchema
        })
      )
      .output(workspaceEnumSchema),
    remove: oc
      .route({
        method: 'DELETE',
        path: '/{workspace}/enums/{id}',
        inputStructure: 'detailed',
        summary: 'Delete enumeration',
        description:
          'Deletes an enumeration definition. This operation will fail if the enumeration is currently in use by any entity schemas.',
        tags: ['Enums']
      })
      .input(
        z.object({
          params: wsAndUUID
        })
      )
      .output(
        z.object({
          success: z.boolean().describe('Whether the deletion was successful'),
          message: z.string().describe('Status message or error details')
        })
      )
  }
});

export type WorkspaceEnum = z.infer<typeof workspaceEnumSchema>;

export type CreateEnumRequest = z.infer<typeof createEnumBodySchema>;

export type UpdateEnumRequest = CreateEnumRequest;
