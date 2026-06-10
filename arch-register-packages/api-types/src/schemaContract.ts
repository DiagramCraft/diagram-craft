import { oc } from '@orpc/contract';
import { z } from 'zod';

const requirementLevelSchema = z.enum(['required', 'expected', 'optional']).nullish();

const baseFieldSchema = z.object({
  id: z.string(),
  name: z.string(),
  requirementLevel: requirementLevelSchema
});

const textFieldSchema = baseFieldSchema.extend({ type: z.literal('text') });
const longtextFieldSchema = baseFieldSchema.extend({ type: z.literal('longtext') });
const booleanFieldSchema = baseFieldSchema.extend({ type: z.literal('boolean') });
const dateFieldSchema = baseFieldSchema.extend({ type: z.literal('date') });
const selectFieldInputSchema = baseFieldSchema.extend({
  type: z.literal('select'),
  enumId: z.string()
});
const referenceFieldSchema = baseFieldSchema.extend({
  type: z.literal('reference'),
  schemaId: z.string(),
  minCount: z.number().int().min(0),
  maxCount: z.number().int().min(-1)
});
const containmentFieldSchema = baseFieldSchema.extend({
  type: z.literal('containment'),
  schemaId: z.string(),
  minCount: z.number().int().min(0),
  maxCount: z.number().int().min(-1)
});

export const schemaFieldInputSchema = z.discriminatedUnion('type', [
  textFieldSchema,
  longtextFieldSchema,
  booleanFieldSchema,
  dateFieldSchema,
  selectFieldInputSchema,
  referenceFieldSchema,
  containmentFieldSchema
]);

export const fieldOptionSchema = z.object({ value: z.string(), label: z.string() });

export const selectFieldResponseSchema = selectFieldInputSchema.extend({
  options: z.array(fieldOptionSchema)
});

export const schemaFieldResponseSchema = z.discriminatedUnion('type', [
  textFieldSchema,
  longtextFieldSchema,
  booleanFieldSchema,
  dateFieldSchema,
  selectFieldResponseSchema,
  referenceFieldSchema,
  containmentFieldSchema
]);

export const entitySchemaSchema = z.object({
  id: z.string(),
  workspace: z.string(),
  name: z.string(),
  description: z.string(),
  fields: z.array(schemaFieldResponseSchema),
  color: z.string().nullable(),
  icon: z.string().nullable(),
  entity_count: z.number().int().min(0),
  created_at: z.string(),
  updated_at: z.string()
});

const createSchemaBodySchema = z.object({
  name: z.string(),
  description: z.preprocess(
    v => (v === undefined ? undefined : typeof v === 'string' ? v : ''),
    z.string().optional()
  ),
  fields: z.preprocess(
    v => (v === undefined ? undefined : Array.isArray(v) ? v : []),
    z.array(schemaFieldInputSchema).optional()
  ),
  color: z.preprocess(
    v => (v === undefined ? undefined : v === null || typeof v === 'string' ? v : null),
    z.string().nullable().optional()
  ),
  icon: z.preprocess(
    v => (v === undefined ? undefined : v === null || typeof v === 'string' ? v : null),
    z.string().nullable().optional()
  ),
  default_owner: z.string().nullable().optional()
});

const updateSchemaBodySchema = createSchemaBodySchema;

export const createSchemaRequestSchema = createSchemaBodySchema.extend({
  workspace: z.string()
});

export const updateSchemaRequestSchema = updateSchemaBodySchema.extend({
  workspace: z.string(),
  id: z.string()
});

export const getSchemaRequestSchema = z.object({
  workspace: z.string(),
  id: z.string()
});

export const listSchemasRequestSchema = z.object({
  workspace: z.string()
});

export const deleteSchemaRequestSchema = z.object({
  workspace: z.string(),
  id: z.string()
});

export const deleteSchemaResponseSchema = z.object({
  success: z.boolean(),
  message: z.string()
});

export const workspaceSchemaContract = {
  schemas: {
    list: oc
      .route({ method: 'GET', path: '/{workspace}/schemas' })
      .input(listSchemasRequestSchema)
      .output(z.array(entitySchemaSchema)),
    get: oc
      .route({ method: 'GET', path: '/{workspace}/schemas/{id}' })
      .input(getSchemaRequestSchema)
      .output(entitySchemaSchema),
    create: oc
      .route({ method: 'POST', path: '/{workspace}/schemas' })
      .input(createSchemaRequestSchema)
      .output(entitySchemaSchema),
    update: oc
      .route({ method: 'PUT', path: '/{workspace}/schemas/{id}' })
      .input(updateSchemaRequestSchema)
      .output(entitySchemaSchema),
    remove: oc
      .route({ method: 'DELETE', path: '/{workspace}/schemas/{id}' })
      .input(deleteSchemaRequestSchema)
      .output(deleteSchemaResponseSchema)
  }
};
