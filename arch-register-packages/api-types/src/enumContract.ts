import { oc } from '@orpc/contract';
import { z } from 'zod';

const enumOptionSchema = z.object({
  value: z.string(),
  label: z.string()
});

const enumOptionsInputSchema = z.preprocess(
  value => (Array.isArray(value) ? value : undefined),
  z.array(enumOptionSchema).optional()
);

const enumSortOrderInputSchema = z.preprocess(
  value => (typeof value === 'number' ? value : undefined),
  z.number().int().min(0).optional()
);

const workspaceEnumSchema = z.object({
  id: z.string(),
  workspace: z.string(),
  name: z.string(),
  options: z.array(enumOptionSchema),
  sort_order: z.number().int().min(0),
  created_at: z.string(),
  updated_at: z.string()
});

const createEnumBodySchema = z.object({
  name: z.string(),
  options: enumOptionsInputSchema,
  sort_order: enumSortOrderInputSchema
});

const updateEnumBodySchema = createEnumBodySchema;

const createEnumRequestSchema = createEnumBodySchema.extend({
  workspace: z.string()
});

const updateEnumRequestSchema = updateEnumBodySchema.extend({
  workspace: z.string(),
  id: z.string()
});

const getEnumRequestSchema = z.object({
  workspace: z.string(),
  id: z.string()
});

const listEnumsRequestSchema = z.object({
  workspace: z.string()
});

const deleteEnumRequestSchema = z.object({
  workspace: z.string(),
  id: z.string()
});

const deleteEnumResponseSchema = z.object({
  success: z.boolean(),
  message: z.string()
});

export const workspaceEnumContract = {
  enums: {
    list: oc
      .route({ method: 'GET', path: '/{workspace}/enums' })
      .input(listEnumsRequestSchema)
      .output(z.array(workspaceEnumSchema)),
    get: oc
      .route({ method: 'GET', path: '/{workspace}/enums/{id}' })
      .input(getEnumRequestSchema)
      .output(workspaceEnumSchema),
    create: oc
      .route({ method: 'POST', path: '/{workspace}/enums' })
      .input(createEnumRequestSchema)
      .output(workspaceEnumSchema),
    update: oc
      .route({ method: 'PUT', path: '/{workspace}/enums/{id}' })
      .input(updateEnumRequestSchema)
      .output(workspaceEnumSchema),
    remove: oc
      .route({ method: 'DELETE', path: '/{workspace}/enums/{id}' })
      .input(deleteEnumRequestSchema)
      .output(deleteEnumResponseSchema)
  }
};

export type WorkspaceEnum = z.infer<typeof workspaceEnumSchema>;

export type CreateEnumRequest = z.infer<typeof createEnumBodySchema>;

export type UpdateEnumRequest = z.infer<typeof updateEnumBodySchema>;
