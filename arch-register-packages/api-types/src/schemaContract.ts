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

const schemaFieldInputSchema = z.discriminatedUnion('type', [
  textFieldSchema,
  longtextFieldSchema,
  booleanFieldSchema,
  dateFieldSchema,
  selectFieldInputSchema,
  referenceFieldSchema,
  containmentFieldSchema
]);

const fieldOptionSchema = z.object({ value: z.string(), label: z.string() });

const selectFieldResponseSchema = selectFieldInputSchema.extend({
  options: z.array(fieldOptionSchema)
});

const schemaFieldResponseSchema = z.discriminatedUnion('type', [
  textFieldSchema,
  longtextFieldSchema,
  booleanFieldSchema,
  dateFieldSchema,
  selectFieldResponseSchema,
  referenceFieldSchema,
  containmentFieldSchema
]);

const entitySchemaSchema = z.object({
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

const deleteSchemaResponseSchema = z.object({
  success: z.boolean(),
  message: z.string()
});

export const workspaceSchemaContract = {
  schemas: {
    list: oc
      .route({ method: 'GET', path: '/{workspace}/schemas', inputStructure: 'detailed' })
      .input(
        z.object({
          params: z.object({
            workspace: z.string()
          })
        })
      )
      .output(z.array(entitySchemaSchema)),
    get: oc
      .route({ method: 'GET', path: '/{workspace}/schemas/{id}', inputStructure: 'detailed' })
      .input(
        z.object({
          params: z.object({
            workspace: z.string(),
            id: z.string()
          })
        })
      )
      .output(entitySchemaSchema),
    create: oc
      .route({ method: 'POST', path: '/{workspace}/schemas', inputStructure: 'detailed' })
      .input(
        z.object({ params: z.object({ workspace: z.string() }), body: createSchemaBodySchema })
      )
      .output(entitySchemaSchema),
    update: oc
      .route({ method: 'PUT', path: '/{workspace}/schemas/{id}', inputStructure: 'detailed' })
      .input(
        z.object({
          params: z.object({
            workspace: z.string(),
            id: z.string()
          }),
          body: updateSchemaBodySchema
        })
      )
      .output(entitySchemaSchema),
    remove: oc
      .route({ method: 'DELETE', path: '/{workspace}/schemas/{id}', inputStructure: 'detailed' })
      .input(
        z.object({
          params: z.object({
            workspace: z.string(),
            id: z.string()
          })
        })
      )
      .output(deleteSchemaResponseSchema)
  }
};

// ── Schema Field Types ────────────────────────────────────────

export type RequirementLevel = 'required' | 'expected' | 'optional';

export type TextField = {
  id: string;
  name: string;
  type: 'text' | 'longtext';
  requirementLevel?: RequirementLevel | null;
};

export type BooleanField = {
  id: string;
  name: string;
  type: 'boolean';
  requirementLevel?: RequirementLevel | null;
};

export type DateField = {
  id: string;
  name: string;
  type: 'date';
  requirementLevel?: RequirementLevel | null;
};

export type SelectField = {
  id: string;
  name: string;
  type: 'select';
  enumId: string;
  requirementLevel?: RequirementLevel | null;
};

export type ReferenceField = {
  id: string;
  name: string;
  type: 'reference';
  schemaId: string;
  minCount: number;
  maxCount: number;
  requirementLevel?: RequirementLevel | null;
};

export type ContainmentField = {
  id: string;
  name: string;
  type: 'containment';
  schemaId: string;
  minCount: number;
  maxCount: number;
  requirementLevel?: RequirementLevel | null;
};

export type SchemaField =
  | TextField
  | BooleanField
  | DateField
  | SelectField
  | ReferenceField
  | ContainmentField;

type FieldOption = {
  value: string;
  label: string;
};

export type ApiSelectField = SelectField & {
  options: FieldOption[];
};

// ── Entity Schema ─────────────────────────────────────────────

export type EntitySchema = z.infer<typeof entitySchemaSchema>;

// ── Workspace Enum ────────────────────────────────────────────
