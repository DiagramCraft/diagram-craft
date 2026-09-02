import { oc } from '@orpc/contract';
import { z } from 'zod';
import {
  ws,
  wsAndUUID,
  namedGroupSchema,
  externalFieldSchema,
  assertRefreshModeRequiresExternalKind,
  fieldMigrationsSchema
} from '@arch-register/api-types/common';
import { validationRuleSchema } from '@arch-register/api-types/schemaContract';
import { categoryRefSchema } from '@arch-register/api-types/categoryContract';

const requirementLevelSchema = z
  .enum(['required', 'expected', 'optional'])
  .nullish()
  .describe('Field requirement level');

const baseRelationFieldSchema = z.object({
  id: z.string().describe('Unique field identifier'),
  name: z.string().describe('Field name'),
  requirementLevel: requirementLevelSchema.describe(
    'Whether the field is required, expected, or optional'
  ),
  archived: z
    .boolean()
    .optional()
    .describe('Whether the field is archived (hidden, but data is retained)'),
  groupId: z
    .string()
    .optional()
    .describe('Id of the presentation-only group this field belongs to; omitted means ungrouped'),
  ...externalFieldSchema.shape
});

const textRelationFieldSchema = baseRelationFieldSchema.extend({
  type: z.literal('text').describe('Single-line text field')
});

const longtextRelationFieldSchema = baseRelationFieldSchema.extend({
  type: z.literal('longtext').describe('Multi-line text field')
});

const booleanRelationFieldSchema = baseRelationFieldSchema.extend({
  type: z.literal('boolean').describe('Boolean (true/false) field')
});

const dateRelationFieldSchema = baseRelationFieldSchema.extend({
  type: z.literal('date').describe('Date field')
});

const numberRelationFieldSchema = baseRelationFieldSchema.extend({
  type: z.literal('number').describe('Integer number field'),
  min: z.number().int().optional().describe('Minimum allowed value'),
  max: z.number().int().optional().describe('Maximum allowed value')
});

const selectRelationCardinalitySchema = {
  minCardinality: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe('Minimum number of selected values required'),
  maxCardinality: z
    .union([z.literal(-1), z.number().int().min(0)])
    .optional()
    .describe('Maximum number of selected values (-1 for unlimited; omitted means one)')
};

const selectRelationFieldInputSchema = baseRelationFieldSchema.extend({
  ...selectRelationCardinalitySchema,
  type: z
    .literal('select')
    .describe('Select dropdown field; cardinality controls whether it accepts one or many values'),
  enumId: z.string().describe('Enumeration identifier for dropdown options')
});

const entityRelationFieldSchema = baseRelationFieldSchema.extend({
  type: z
    .literal('entityRelation')
    .describe('Reference from a relation instance to one or more entities'),
  predicate: z
    .string()
    .max(100)
    .regex(/^[a-zA-Z0-9\s-]+$/)
    .optional()
    .describe('Relationship predicate/label'),
  schemaId: z.string().describe('Target entity schema identifier'),
  minCount: z.number().int().min(0).describe('Minimum number of entity references required'),
  maxCount: z
    .union([z.literal(-1), z.number().int().min(0)])
    .describe('Maximum number of entity references (-1 for unlimited)')
});

const derivedRelationResultTypeSchema = z.enum([
  'text',
  'number',
  'currency',
  'select',
  'boolean',
  'rating'
]);

const derivedRelationFieldBaseSchema = baseRelationFieldSchema
  .omit({ external_kind: true, refresh_mode: true })
  .extend({
    external_kind: z.never().optional(),
    refresh_mode: z.never().optional()
  });

const derivedRelationFieldInputSchema = derivedRelationFieldBaseSchema
  .extend({
    type: z
      .literal('derived')
      .describe('Read-only value derived from the relation and the entities it connects'),
    requirementLevel: z.literal('optional').describe('Derived fields are never required'),
    expression: z.string().min(1).describe('Sandboxed expression used to calculate the value'),
    resultType: derivedRelationResultTypeSchema.describe('Underlying type of the calculated value'),
    enumId: z.string().optional().describe('Workspace enumeration for a derived select result')
  })
  .superRefine((field, ctx) => {
    if (field.resultType === 'select' && !field.enumId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['enumId'],
        message: 'Derived select fields require enumId'
      });
    }
    if (field.resultType !== 'select' && field.enumId !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['enumId'],
        message: 'enumId is only valid for derived select fields'
      });
    }
  });

// Note: unlike EntitySchema fields, relation fields intentionally exclude `containment` — a
// relation's structural connections to entities are its `in`/`out` endpoints below, plus any
// `entityRelation` fields it declares; there is no notion of a relation "containing" an entity.
// `derived` fields are supported (#3091): they read the relation's own fields and, via
// `entityRelation` fields or the `in`/`out` endpoints, the connected entities' fields.
export const relationFieldInputSchema = z
  .discriminatedUnion('type', [
    textRelationFieldSchema,
    longtextRelationFieldSchema,
    booleanRelationFieldSchema,
    dateRelationFieldSchema,
    numberRelationFieldSchema,
    selectRelationFieldInputSchema,
    entityRelationFieldSchema,
    derivedRelationFieldInputSchema
  ])
  .superRefine((field, ctx) => {
    const issue = assertRefreshModeRequiresExternalKind(field);
    if (issue) ctx.addIssue({ code: z.ZodIssueCode.custom, ...issue });
    if (
      field.type === 'select' &&
      field.minCardinality !== undefined &&
      field.maxCardinality !== undefined &&
      field.maxCardinality !== -1 &&
      field.minCardinality > field.maxCardinality
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['minCardinality'],
        message: 'minCardinality must be less than or equal to maxCardinality'
      });
    }
  })
  .describe('Relation field definition');

const fieldOptionSchema = z.object({
  value: z.string().describe('Internal option value'),
  label: z.string().describe('Display label'),
  description: z.string().nullable().optional().describe('Optional option description'),
  retired: z.boolean().optional().describe('Whether the option is retired'),
  restricted: z.boolean().optional().describe('Whether the option represents restricted data')
});

const selectRelationFieldResponseSchema = selectRelationFieldInputSchema.extend({
  options: z.array(fieldOptionSchema).describe('Available dropdown options')
});

const derivedRelationFieldResponseSchema = derivedRelationFieldInputSchema
  .extend({
    options: z.array(fieldOptionSchema).optional().describe('Resolved options for a derived select')
  })
  .superRefine((field, ctx) => {
    if (field.resultType === 'select' && (!field.options || field.options.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['options'],
        message: 'Derived select fields require resolved options'
      });
    }
  });

export const relationFieldResponseSchema = z
  .discriminatedUnion('type', [
    textRelationFieldSchema,
    longtextRelationFieldSchema,
    booleanRelationFieldSchema,
    dateRelationFieldSchema,
    numberRelationFieldSchema,
    selectRelationFieldResponseSchema,
    entityRelationFieldSchema,
    derivedRelationFieldResponseSchema
  ])
  .superRefine((field, ctx) => {
    const issue = assertRefreshModeRequiresExternalKind(field);
    if (issue) ctx.addIssue({ code: z.ZodIssueCode.custom, ...issue });
    if (
      field.type === 'select' &&
      field.minCardinality !== undefined &&
      field.maxCardinality !== undefined &&
      field.maxCardinality !== -1 &&
      field.minCardinality > field.maxCardinality
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['minCardinality'],
        message: 'minCardinality must be less than or equal to maxCardinality'
      });
    }
  })
  .describe('Relation field with resolved options');

const fieldGroupAccessControlSchema = z
  .object({
    teamIds: z.array(z.string()).describe('Teams whose role determines view/edit access')
  })
  .describe('Optional access-control binding for a field group');

const relationSchemaGroupSchema = namedGroupSchema.extend({
  accessControl: fieldGroupAccessControlSchema
    .optional()
    .describe('If set, restricts view/edit of this group to members of the listed teams')
});

const sharedFieldGroupLinkSchema = z
  .object({
    groupId: z.string().describe('Id of the included workspace shared fieldgroup'),
    teamIds: z
      .array(z.string())
      .optional()
      .describe('Teams whose role determines view/edit access for this inclusion')
  })
  .describe('A schema-local inclusion of a workspace shared fieldgroup');

export const relationEndpointSchema = z
  .object({
    schemaIds: z
      .union([z.literal('any'), z.array(z.string()).min(1)])
      .describe('Entity schema identifiers allowed at this endpoint, or "any" for no restriction'),
    label: z
      .string()
      .trim()
      .min(1)
      .optional()
      .describe('Contextual label for this endpoint when viewed from an entity')
  })
  .describe('Typed endpoint constraint and contextual label for a relation schema');

export const relationSchemaSchema = z.object({
  id: z.string().describe('Unique relation schema identifier'),
  workspace: z.string().describe('Parent workspace identifier'),
  name: z.string().describe('Relation schema name'),
  category: categoryRefSchema
    .nullable()
    .describe('Workspace category used to group this relation schema'),
  description: z.string().describe('Relation schema description'),
  in: relationEndpointSchema.describe('Allowed entity schemas and label for the "in" endpoint'),
  out: relationEndpointSchema.describe('Allowed entity schemas and label for the "out" endpoint'),
  fields: z.array(relationFieldResponseSchema).describe('Relation field definitions'),
  groups: z
    .array(relationSchemaGroupSchema)
    .describe('Named, presentation-only field groups, in display order'),
  shared_field_group_links: z
    .array(sharedFieldGroupLinkSchema)
    .optional()
    .describe('Included workspace shared fieldgroups, in display order'),
  validation_rules: z
    .array(validationRuleSchema)
    .optional()
    .describe('Bonsai validation rules evaluated when typed relations are saved'),
  color: z.string().nullable().describe('Relation schema color (hex format)'),
  icon: z.string().nullable().describe('Relation schema icon identifier'),
  relation_count: z
    .number()
    .int()
    .min(0)
    .describe('Number of relation instances using this schema'),
  unique_endpoint_pair: z
    .boolean()
    .describe('Whether active relation instances must have a unique ordered endpoint pair'),
  version: z.number().int().min(1).describe('Current schema version number'),
  relation_approval_policy: z
    .enum(['required', 'disabled'])
    .optional()
    .describe(
      'Approval policy for relation instance changes. "required" is not yet supported — see #2574.'
    ),
  created_at: z.string().describe('ISO 8601 creation timestamp'),
  updated_at: z.string().describe('ISO 8601 last update timestamp')
});

const relationSchemaVersionSchema = z.object({
  version: z.number().int().min(1).describe('Version number'),
  name: z.string().describe('Relation schema name at this version'),
  category: z.string().nullable().describe('Relation schema category at this version'),
  description: z.string().describe('Relation schema description at this version'),
  in: relationEndpointSchema.describe('"in" endpoint constraint at this version'),
  out: relationEndpointSchema.describe('"out" endpoint constraint at this version'),
  fields: z.array(relationFieldResponseSchema).describe('Field definitions at this version'),
  groups: z.array(relationSchemaGroupSchema).describe('Field groups at this version'),
  shared_field_group_links: z
    .array(sharedFieldGroupLinkSchema)
    .optional()
    .describe('Included workspace shared fieldgroups at this version'),
  validation_rules: z
    .array(validationRuleSchema)
    .optional()
    .describe('Bonsai validation rules at this version'),
  color: z.string().nullable().describe('Relation schema color at this version'),
  icon: z.string().nullable().describe('Relation schema icon at this version'),
  unique_endpoint_pair: z
    .boolean()
    .describe(
      'Whether active relation instances must have a unique ordered endpoint pair at this version'
    ),
  changeSummary: z
    .record(z.string(), z.unknown())
    .describe('Summary of what changed relative to the previous version'),
  createdBy: z.string().nullable().describe('User id who made this change'),
  createdAt: z.string().describe('ISO 8601 timestamp of this version')
});

const createRelationSchemaBodySchema = z.object({
  name: z.string().describe('Relation schema name'),
  category_id: z
    .string()
    .nullable()
    .optional()
    .describe('Workspace category id used to group this relation schema'),
  description: z.preprocess(
    v => (v === undefined ? undefined : typeof v === 'string' ? v : ''),
    z.string().optional().describe('Relation schema description')
  ),
  in: relationEndpointSchema.describe('Allowed entity schemas for the "in" endpoint'),
  out: relationEndpointSchema.describe('Allowed entity schemas for the "out" endpoint'),
  fields: z.preprocess(
    v => (v === undefined ? undefined : Array.isArray(v) ? v : []),
    z.array(relationFieldInputSchema).optional().describe('Initial field definitions')
  ),
  groups: z.preprocess(
    v => (v === undefined ? undefined : Array.isArray(v) ? v : []),
    z.array(relationSchemaGroupSchema).optional().describe('Named, presentation-only field groups')
  ),
  shared_field_group_links: z.preprocess(
    v => (v === undefined ? undefined : Array.isArray(v) ? v : []),
    z.array(sharedFieldGroupLinkSchema).optional().describe('Included workspace shared fieldgroups')
  ),
  validation_rules: z
    .array(validationRuleSchema)
    .optional()
    .describe('Initial Bonsai validation rules'),
  color: z.preprocess(
    v => (v === undefined ? undefined : v === null || typeof v === 'string' ? v : null),
    z.string().nullable().optional().describe('Relation schema color (hex format)')
  ),
  icon: z.preprocess(
    v => (v === undefined ? undefined : v === null || typeof v === 'string' ? v : null),
    z.string().nullable().optional().describe('Relation schema icon identifier')
  ),
  unique_endpoint_pair: z
    .boolean()
    .optional()
    .describe('Prevent duplicate active relations for the same ordered endpoint pair'),
  relation_approval_policy: z
    .enum(['required', 'disabled'])
    .optional()
    .describe(
      'Approval policy for relation instance changes. "required" is not yet supported — see #2574.'
    )
});

const updateRelationSchemaBodySchema = createRelationSchemaBodySchema.extend({
  fieldMigrations: fieldMigrationsSchema
    .optional()
    .describe(
      'Resolutions for fields being renamed/removed/archived while relation instances exist, keyed by the old field id'
    )
});

const deleteRelationSchemaResponseSchema = z.object({
  success: z.boolean().describe('Whether the deletion was successful'),
  message: z.string().describe('Status message or error details')
});

export const workspaceRelationSchemaContract = oc.tag('RelationSchemas').router({
  relationSchemas: {
    list: oc
      .route({
        method: 'GET',
        path: '/{workspace}/relation-schemas',
        inputStructure: 'detailed',
        summary: 'List relation schemas',
        description:
          'Retrieves all relation schema definitions for the workspace. Relation schemas define typed, ' +
          'first-class relationship types between entities, with their own configurable fields.',
        tags: ['RelationSchemas']
      })
      .input(z.object({ params: ws }))
      .output(z.array(relationSchemaSchema)),
    get: oc
      .route({
        method: 'GET',
        path: '/{workspace}/relation-schemas/{id}',
        inputStructure: 'detailed',
        summary: 'Get relation schema details',
        description:
          'Retrieves a specific relation schema definition by ID, including endpoint constraints, field ' +
          'definitions, and metadata.',
        tags: ['RelationSchemas']
      })
      .input(z.object({ params: wsAndUUID }))
      .output(relationSchemaSchema),
    create: oc
      .route({
        method: 'POST',
        path: '/{workspace}/relation-schemas',
        inputStructure: 'detailed',
        summary: 'Create relation schema',
        description:
          'Creates a new relation schema definition with the specified endpoint constraints and fields.',
        tags: ['RelationSchemas']
      })
      .input(z.object({ params: ws, body: createRelationSchemaBodySchema }))
      .output(relationSchemaSchema),
    update: oc
      .route({
        method: 'PUT',
        path: '/{workspace}/relation-schemas/{id}',
        inputStructure: 'detailed',
        summary: 'Update relation schema',
        description:
          'Updates an existing relation schema definition. Changes to fields will affect all relation ' +
          'instances using this schema.',
        tags: ['RelationSchemas']
      })
      .input(z.object({ params: wsAndUUID, body: updateRelationSchemaBodySchema }))
      .output(relationSchemaSchema),
    remove: oc
      .route({
        method: 'DELETE',
        path: '/{workspace}/relation-schemas/{id}',
        inputStructure: 'detailed',
        summary: 'Delete relation schema',
        description:
          'Deletes a relation schema definition. This operation will fail if there are relation instances ' +
          'using this schema.',
        tags: ['RelationSchemas']
      })
      .input(z.object({ params: wsAndUUID }))
      .output(deleteRelationSchemaResponseSchema),
    listVersions: oc
      .route({
        method: 'GET',
        path: '/{workspace}/relation-schemas/{id}/versions',
        inputStructure: 'detailed',
        summary: 'List relation schema version history',
        description:
          'Retrieves the version history for a relation schema, newest first, including who changed what and when.',
        tags: ['RelationSchemas']
      })
      .input(z.object({ params: wsAndUUID }))
      .output(z.array(relationSchemaVersionSchema))
  }
});

// ── Relation Field Types ──────────────────────────────────────

export type RelationField = z.infer<typeof relationFieldInputSchema>;
export type RelationFieldInput = z.infer<typeof relationFieldInputSchema>;
export type EntityRelationField = Extract<RelationField, { type: 'entityRelation' }>;

export const isEntityRelationField = (field: RelationField): field is EntityRelationField =>
  field.type === 'entityRelation';

export type RelationDerivedField = Extract<RelationField, { type: 'derived' }>;

export const isRelationDerivedField = (field: RelationField): field is RelationDerivedField =>
  field.type === 'derived';

// ── Relation Schema ────────────────────────────────────────────

export type RelationSchema = z.infer<typeof relationSchemaSchema>;
export type RelationEndpoint = z.infer<typeof relationEndpointSchema>;
export type RelationSchemaGroup = z.infer<typeof relationSchemaGroupSchema>;
export type CreateRelationSchemaRequest = z.infer<typeof createRelationSchemaBodySchema>;
export type UpdateRelationSchemaRequest = z.infer<typeof updateRelationSchemaBodySchema>;

// ── Relation Schema Versioning & Field Migrations ─────────────

export type RelationSchemaVersion = z.infer<typeof relationSchemaVersionSchema>;
export type { FieldMigrationAction, FieldMigrations } from '@arch-register/api-types/common';

// Mutation errors deliberately contain structural identifiers and counts only. Relation field
// values and other restricted relation data must never be copied into this diagnostic payload.
export type RelationConstraintViolation =
  | {
      kind: 'typed_relation_minimum' | 'typed_relation_maximum';
      relation_schema_id: string;
      field_id: string;
      field_name: string;
      direction: 'in' | 'out';
      entity_id?: string;
      projected_count: number;
      limit: number;
    }
  | {
      kind: 'endpoint_pair_unique';
      relation_schema_id: string;
      in_entity_id?: string;
      out_entity_id?: string;
      existing_count: number;
      projected_count: number;
    };

export type RelationConstraintErrorData = {
  code: 'RELATION_CONSTRAINT_VIOLATION';
  violations: RelationConstraintViolation[];
  total_violation_count: number;
  hidden_violation_count: number;
  truncated: boolean;
};
