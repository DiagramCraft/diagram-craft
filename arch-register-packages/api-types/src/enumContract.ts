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

export const workspaceEnumSchema = z.object({
  id: z.string(),
  workspace: z.string(),
  name: z.string(),
  options: z.array(enumOptionSchema),
  sort_order: z.number().int().min(0),
  created_at: z.string(),
  updated_at: z.string()
});

export const createEnumBodySchema = z.object({
  name: z.string(),
  options: enumOptionsInputSchema,
  sort_order: enumSortOrderInputSchema
});

export const updateEnumBodySchema = createEnumBodySchema;

export const createEnumRequestSchema = createEnumBodySchema.extend({
  workspace: z.string()
});

export const updateEnumRequestSchema = updateEnumBodySchema.extend({
  workspace: z.string(),
  id: z.string(),
});

export const getEnumRequestSchema = z.object({
  workspace: z.string(),
  id: z.string()
});

export const listEnumsRequestSchema = z.object({
  workspace: z.string()
});

export const deleteEnumRequestSchema = z.object({
  workspace: z.string(),
  id: z.string()
});

export const deleteEnumResponseSchema = z.object({
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
