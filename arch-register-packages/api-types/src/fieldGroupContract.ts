import { oc } from '@orpc/contract';
import { z } from 'zod';
import { ws, wsAndUUID } from '@arch-register/api-types/common';
import {
  schemaFieldInputSchema,
  schemaFieldResponseSchema,
  FieldMigrations
} from '@arch-register/api-types/schemaContract';

const sharedFieldGroupSchema = z.object({
  id: z.string().describe('Unique shared fieldgroup identifier (UUID)'),
  workspace: z.string().describe('Parent workspace identifier'),
  name: z.string().describe('Fieldgroup name (unique within workspace)'),
  description: z.string().optional().describe('Optional fieldgroup description'),
  fields: z.array(schemaFieldResponseSchema).describe('Reusable field definitions'),
  sort_order: z.number().int().min(0).describe('Display order (0-based)'),
  created_at: z.string().describe('ISO 8601 creation timestamp'),
  updated_at: z.string().describe('ISO 8601 last update timestamp')
});

const sharedFieldGroupBodySchema = z.object({
  name: z.string().describe('Fieldgroup name (unique within workspace)'),
  description: z.string().optional().describe('Optional fieldgroup description'),
  fields: z
    .array(schemaFieldInputSchema)
    .optional()
    .describe('Reusable field definitions; groupId is assigned by the server'),
  sort_order: z.number().int().min(0).optional().describe('Display order (0-based)')
});

const updateSharedFieldGroupBodySchema = sharedFieldGroupBodySchema.extend({
  fieldMigrations: z
    .record(
      z.string(),
      z.object({
        action: z.enum(['rename', 'remove', 'archive']),
        renameTo: z.string().optional()
      })
    )
    .optional()
    .describe('Field migration decisions applied to every including schema')
});

export const workspaceFieldGroupContract = oc.tag('Fieldgroups').router({
  fieldGroups: {
    list: oc
      .route({
        method: 'GET',
        path: '/{workspace}/fieldgroups',
        inputStructure: 'detailed',
        summary: 'List workspace shared fieldgroups',
        tags: ['Fieldgroups']
      })
      .input(z.object({ params: ws }))
      .output(z.array(sharedFieldGroupSchema)),
    get: oc
      .route({
        method: 'GET',
        path: '/{workspace}/fieldgroups/{id}',
        inputStructure: 'detailed',
        summary: 'Get a shared fieldgroup',
        tags: ['Fieldgroups']
      })
      .input(z.object({ params: wsAndUUID }))
      .output(sharedFieldGroupSchema),
    create: oc
      .route({
        method: 'POST',
        path: '/{workspace}/fieldgroups',
        inputStructure: 'detailed',
        summary: 'Create a shared fieldgroup',
        tags: ['Fieldgroups']
      })
      .input(z.object({ params: ws, body: sharedFieldGroupBodySchema }))
      .output(sharedFieldGroupSchema),
    update: oc
      .route({
        method: 'PUT',
        path: '/{workspace}/fieldgroups/{id}',
        inputStructure: 'detailed',
        summary: 'Update a shared fieldgroup',
        tags: ['Fieldgroups']
      })
      .input(z.object({ params: wsAndUUID, body: updateSharedFieldGroupBodySchema }))
      .output(sharedFieldGroupSchema),
    remove: oc
      .route({
        method: 'DELETE',
        path: '/{workspace}/fieldgroups/{id}',
        inputStructure: 'detailed',
        summary: 'Delete a shared fieldgroup',
        tags: ['Fieldgroups']
      })
      .input(z.object({ params: wsAndUUID }))
      .output(z.object({ success: z.boolean(), message: z.string() }))
  }
});

export type SharedFieldGroup = z.infer<typeof sharedFieldGroupSchema>;
export type CreateSharedFieldGroupRequest = z.infer<typeof sharedFieldGroupBodySchema>;
export type UpdateSharedFieldGroupRequest = z.infer<typeof updateSharedFieldGroupBodySchema>;
export type SharedFieldGroupMigrations = FieldMigrations;
