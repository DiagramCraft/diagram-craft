import { oc } from '@orpc/contract';
import { z } from 'zod';
import { ws, wsAndUUID } from '@arch-register/api-types/common';

const requirementLevelSchema = z
  .enum(['required', 'expected', 'optional'])
  .nullish()
  .describe('Field requirement level');

const baseFieldSchema = z.object({
  id: z.string().describe('Unique field identifier'),
  name: z.string().describe('Field name'),
  requirementLevel: requirementLevelSchema.describe(
    'Whether the field is required, expected, or optional'
  ),
  archived: z
    .boolean()
    .optional()
    .describe('Whether the field is archived (hidden, but data is retained)')
});

const textFieldSchema = baseFieldSchema.extend({
  type: z.literal('text').describe('Single-line text field')
});

const longtextFieldSchema = baseFieldSchema.extend({
  type: z.literal('longtext').describe('Multi-line text field')
});

const booleanFieldSchema = baseFieldSchema.extend({
  type: z.literal('boolean').describe('Boolean (true/false) field')
});

const dateFieldSchema = baseFieldSchema.extend({
  type: z.literal('date').describe('Date field')
});

const numberFieldSchema = baseFieldSchema.extend({
  type: z.literal('number').describe('Integer number field'),
  min: z.number().int().optional().describe('Minimum allowed value'),
  max: z.number().int().optional().describe('Maximum allowed value')
});

const selectFieldInputSchema = baseFieldSchema.extend({
  type: z.literal('select').describe('Single-select dropdown field'),
  enumId: z.string().describe('Enumeration identifier for dropdown options')
});

const referenceFieldSchema = baseFieldSchema.extend({
  type: z.literal('reference').describe('Reference to other entities'),
  predicate: z
    .string()
    .max(100)
    .regex(/^[a-zA-Z0-9\s-]+$/)
    .optional()
    .describe('Relationship predicate/label'),
  schemaId: z.string().describe('Target schema identifier'),
  minCount: z.number().int().min(0).describe('Minimum number of references required'),
  maxCount: z
    .union([z.literal(-1), z.number().int().min(0)])
    .describe('Maximum number of references (-1 for unlimited)')
});

const containmentFieldSchema = baseFieldSchema.extend({
  type: z.literal('containment').describe('Containment relationship (parent-child)'),
  predicate: z
    .string()
    .max(100)
    .regex(/^[a-zA-Z0-9\s-]+$/)
    .optional()
    .describe('Relationship predicate/label'),
  schemaId: z.string().describe('Target schema identifier'),
  minCount: z.union([z.literal(0), z.literal(1)]).describe('Minimum count (0 or 1)'),
  maxCount: z.literal(1).describe('Maximum count (always 1 for containment)')
});

const schemaFieldInputSchema = z
  .discriminatedUnion('type', [
    textFieldSchema,
    longtextFieldSchema,
    booleanFieldSchema,
    dateFieldSchema,
    numberFieldSchema,
    selectFieldInputSchema,
    referenceFieldSchema,
    containmentFieldSchema
  ])
  .describe('Schema field definition');

const fieldOptionSchema = z.object({
  value: z.string().describe('Internal option value'),
  label: z.string().describe('Display label')
});

const selectFieldResponseSchema = selectFieldInputSchema.extend({
  options: z.array(fieldOptionSchema).describe('Available dropdown options')
});

const schemaFieldResponseSchema = z
  .discriminatedUnion('type', [
    textFieldSchema,
    longtextFieldSchema,
    booleanFieldSchema,
    dateFieldSchema,
    numberFieldSchema,
    selectFieldResponseSchema,
    referenceFieldSchema,
    containmentFieldSchema
  ])
  .describe('Schema field with resolved options');

const entityTemplateFieldValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.string())
]);

const entityTemplateSchema = z
  .object({
    id: z.string().min(1).describe('Stable template identifier'),
    name: z.string().min(1).describe('Template display name'),
    values: z.object({
      description: z.string().optional().describe('Default entity description'),
      owner: z.string().optional().describe('Default owner team identifier'),
      lifecycle: z.string().optional().describe('Default lifecycle state identifier'),
      namespace: z.string().optional().describe('Default entity namespace'),
      tags: z.array(z.string()).optional().describe('Default entity tags'),
      fields: z.record(z.string(), entityTemplateFieldValueSchema).describe('Schema field defaults')
    })
  })
  .describe('Named defaults for creating an entity of this schema');

const entitySchemaSchema = z.object({
  id: z.string().describe('Unique schema identifier'),
  workspace: z.string().describe('Parent workspace identifier'),
  name: z.string().describe('Schema name'),
  description: z.string().describe('Schema description'),
  key_prefix: z.string().describe('Prefix for entity public IDs (e.g., "APP" for APP-001)'),
  fields: z.array(schemaFieldResponseSchema).describe('Schema field definitions'),
  templates: z.array(entityTemplateSchema).describe('Named entity creation templates'),
  color: z.string().nullable().describe('Schema color (hex format)'),
  icon: z.string().nullable().describe('Schema icon identifier'),
  entity_count: z.number().int().min(0).describe('Number of entities using this schema'),
  version: z.number().int().min(1).describe('Current schema version number'),
  entity_approval_policy: z
    .enum(['required', 'disabled'])
    .optional()
    .describe('Default approval policy for existing entity changes'),
  deprecation_policy: z
    .enum(['required', 'disabled'])
    .optional()
    .describe('Whether entities of this schema can go through the deprecation workflow'),
  created_at: z.string().describe('ISO 8601 creation timestamp'),
  updated_at: z.string().describe('ISO 8601 last update timestamp')
});

const fieldMigrationActionSchema = z
  .object({
    action: z.enum(['rename', 'remove', 'archive']).describe('Migration action for this field'),
    renameTo: z.string().optional().describe('New field id when action is "rename"')
  })
  .describe('How to migrate a changed/removed field');

const schemaVersionSchema = z.object({
  version: z.number().int().min(1).describe('Version number'),
  name: z.string().describe('Schema name at this version'),
  description: z.string().describe('Schema description at this version'),
  fields: z.array(schemaFieldResponseSchema).describe('Field definitions at this version'),
  templates: z.array(entityTemplateSchema).describe('Templates at this version'),
  color: z.string().nullable().describe('Schema color at this version'),
  icon: z.string().nullable().describe('Schema icon at this version'),
  changeSummary: z
    .record(z.string(), z.unknown())
    .describe('Summary of what changed relative to the previous version'),
  createdBy: z.string().nullable().describe('User id who made this change'),
  createdAt: z.string().describe('ISO 8601 timestamp of this version')
});

const createSchemaBodySchema = z.object({
  name: z.string().describe('Schema name'),
  key_prefix: z
    .string()
    .optional()
    .describe('Prefix for entity public IDs (auto-generated if not provided)'),
  description: z.preprocess(
    v => (v === undefined ? undefined : typeof v === 'string' ? v : ''),
    z.string().optional().describe('Schema description')
  ),
  fields: z.preprocess(
    v => (v === undefined ? undefined : Array.isArray(v) ? v : []),
    z.array(schemaFieldInputSchema).optional().describe('Initial field definitions')
  ),
  templates: z.preprocess(
    v => (v === undefined ? undefined : Array.isArray(v) ? v : []),
    z.array(entityTemplateSchema).optional().describe('Named entity creation templates')
  ),
  color: z.preprocess(
    v => (v === undefined ? undefined : v === null || typeof v === 'string' ? v : null),
    z.string().nullable().optional().describe('Schema color (hex format)')
  ),
  icon: z.preprocess(
    v => (v === undefined ? undefined : v === null || typeof v === 'string' ? v : null),
    z.string().nullable().optional().describe('Schema icon identifier')
  ),
  default_owner: z.string().nullable().optional().describe('Default owner for new entities'),
  entity_approval_policy: z
    .enum(['required', 'disabled'])
    .optional()
    .describe('Default approval policy for existing entity changes'),
  deprecation_policy: z
    .enum(['required', 'disabled'])
    .optional()
    .describe('Whether entities of this schema can go through the deprecation workflow')
});

const updateSchemaBodySchema = createSchemaBodySchema.extend({
  fieldMigrations: z
    .record(z.string(), fieldMigrationActionSchema)
    .optional()
    .describe(
      'Resolutions for fields being renamed/removed/archived while entities exist, keyed by the old field id'
    )
});

const deleteSchemaResponseSchema = z.object({
  success: z.boolean().describe('Whether the deletion was successful'),
  message: z.string().describe('Status message or error details')
});

export const workspaceSchemaContract = oc.tag('Schemas').router({
  schemas: {
    list: oc
      .route({
        method: 'GET',
        path: '/{workspace}/schemas',
        inputStructure: 'detailed',
        summary: 'List entity schemas',
        description:
          'Retrieves all entity schema definitions for the workspace. Schemas define the structure and fields for different types of entities.',
        tags: ['Schemas']
      })
      .input(
        z.object({
          params: ws
        })
      )
      .output(z.array(entitySchemaSchema)),
    get: oc
      .route({
        method: 'GET',
        path: '/{workspace}/schemas/{id}',
        inputStructure: 'detailed',
        summary: 'Get schema details',
        description:
          'Retrieves a specific entity schema definition by ID, including all field definitions and metadata.',
        tags: ['Schemas']
      })
      .input(
        z.object({
          params: wsAndUUID
        })
      )
      .output(entitySchemaSchema),
    create: oc
      .route({
        method: 'POST',
        path: '/{workspace}/schemas',
        inputStructure: 'detailed',
        summary: 'Create entity schema',
        description:
          'Creates a new entity schema definition with the specified fields. Schemas define the structure for entities in the workspace.',
        tags: ['Schemas']
      })
      .input(z.object({ params: ws, body: createSchemaBodySchema }))
      .output(entitySchemaSchema),
    update: oc
      .route({
        method: 'PUT',
        path: '/{workspace}/schemas/{id}',
        inputStructure: 'detailed',
        summary: 'Update entity schema',
        description:
          'Updates an existing entity schema definition. Changes to fields will affect all entities using this schema.',
        tags: ['Schemas']
      })
      .input(
        z.object({
          params: wsAndUUID,
          body: updateSchemaBodySchema
        })
      )
      .output(entitySchemaSchema),
    remove: oc
      .route({
        method: 'DELETE',
        path: '/{workspace}/schemas/{id}',
        inputStructure: 'detailed',
        summary: 'Delete entity schema',
        description:
          'Deletes an entity schema definition. This operation will fail if there are entities using this schema.',
        tags: ['Schemas']
      })
      .input(
        z.object({
          params: wsAndUUID
        })
      )
      .output(deleteSchemaResponseSchema),
    listVersions: oc
      .route({
        method: 'GET',
        path: '/{workspace}/schemas/{id}/versions',
        inputStructure: 'detailed',
        summary: 'List schema version history',
        description:
          'Retrieves the version history for a schema, newest first, including who changed what and when.',
        tags: ['Schemas']
      })
      .input(
        z.object({
          params: wsAndUUID
        })
      )
      .output(z.array(schemaVersionSchema))
  }
});

// ── Schema Field Types ────────────────────────────────────────

export type SchemaField = z.infer<typeof schemaFieldInputSchema>;
export type ApiSelectField = z.infer<typeof selectFieldResponseSchema>;
export type ReferenceField = Extract<SchemaField, { type: 'reference' }>;
export type ContainmentField = Extract<SchemaField, { type: 'containment' }>;

// ── Entity Schema ─────────────────────────────────────────────

export type EntitySchema = z.infer<typeof entitySchemaSchema>;
export type EntityTemplate = z.infer<typeof entityTemplateSchema>;
export type EntityTemplateValues = EntityTemplate['values'];

// ── Schema Versioning & Field Migrations ─────────────────────

export type FieldMigrationAction = z.infer<typeof fieldMigrationActionSchema>;
export type FieldMigrations = Record<string, FieldMigrationAction>;
export type SchemaVersion = z.infer<typeof schemaVersionSchema>;

export type PendingFieldChange = {
  fieldId: string;
  fieldName: string;
  kind: 'removed' | 'renamed';
  renamedToId?: string;
  entityCount: number;
};

export type SchemaMigrationRequiredError = {
  code: 'SCHEMA_MIGRATION_REQUIRED';
  pendingChanges: PendingFieldChange[];
};

// ── Workspace Enum ────────────────────────────────────────────
