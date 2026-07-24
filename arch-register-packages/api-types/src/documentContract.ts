import { oc } from '@orpc/contract';
import { z } from 'zod';
import {
  ws,
  wsAndId,
  externalFieldSchema,
  assertRefreshModeRequiresExternalKind,
  externalMetadataResultSchema,
  externalMetadataSchema
} from '@arch-register/api-types/common';

const booleanQuerySchema = z.preprocess(value => {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}, z.boolean().optional());

export const documentFieldTypeSchema = z.enum([
  'text',
  'long_text',
  'boolean',
  'date',
  'number',
  'enum',
  'entity_link',
  'document_link',
  'user_link',
  'team_link'
]);

export const documentRequirementSchema = z.enum(['required', 'expected', 'optional']);

export const documentValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.string()),
  z.null()
]);

export const documentMetadataSchema = z.record(z.string(), documentValueSchema);

export const documentWorkflowStatusSchema = z.object({
  fieldId: z.string(),
  effectiveValue: z.string().nullable(),
  pendingValue: z.string().nullable(),
  requestId: z.string().nullable(),
  caseId: z.string().nullable(),
  approvalsReceived: z.number().int().nonnegative(),
  approvalsRequired: z.number().int().positive(),
  state: z.enum(['none', 'pending', 'changes_requested', 'blocked'])
});

export const documentWorkflowHistoryEventSchema = z.object({
  id: z.string(),
  fieldId: z.string(),
  fieldName: z.string(),
  eventType: z.enum(['approved', 'rejected', 'admin_override']),
  actorUserId: z.string().nullable(),
  occurredAt: z.string(),
  reason: z.string().nullable(),
  targetValue: z.string().nullable(),
  caseId: z.string()
});

export const documentStatusApprovalSchema = z.object({
  required: z.boolean(),
  requiredApprovals: z.number().int().positive().optional(),
  approverFieldId: z.string().min(1).optional(),
  fallbackUserIds: z.array(z.string().min(1)).default([]),
  fallbackTeamIds: z.array(z.string().min(1)).default([])
});

export const documentEnumOptionSchema = z.object({
  value: z.string().min(1),
  label: z.string().min(1),
  approval: documentStatusApprovalSchema.optional()
});

export const documentFieldSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    type: documentFieldTypeSchema,
    requirement: documentRequirementSchema,
    minCardinality: z.number().int().nonnegative().optional(),
    maxCardinality: z.number().int().nonnegative().optional(),
    enumOptions: z.array(documentEnumOptionSchema).optional(),
    isStatus: z.boolean().optional(),
    // Display label used when presenting the reverse of this link on the target
    // (e.g. a "Supersedes" document_link field with inverseName "Superseded by").
    // Only meaningful for entity_link / document_link fields.
    inverseName: z.string().min(1).optional(),
    retired: z.boolean().default(false),
    ...externalFieldSchema.shape
  })
  .superRefine((field, ctx) => {
    const issue = assertRefreshModeRequiresExternalKind(field);
    if (issue) ctx.addIssue({ code: z.ZodIssueCode.custom, ...issue });
  });

export const documentAiToolIdSchema = z.enum([
  'query_entities',
  'get_entity_details',
  'traverse_relations'
]);

export type DocumentAiToolId = z.infer<typeof documentAiToolIdSchema>;

export const DOCUMENT_AI_READ_ONLY_TOOLS: ReadonlyArray<{
  id: DocumentAiToolId;
  label: string;
  description: string;
}> = [
  {
    id: 'query_entities',
    label: 'Query entities',
    description: 'Find visible entities by text, schema, owner, or lifecycle.'
  },
  {
    id: 'get_entity_details',
    label: 'Get entity details',
    description: 'Read an entity, its fields, and its visible relationships.'
  },
  {
    id: 'traverse_relations',
    label: 'Traverse relations',
    description: 'Explore visible entity relationships across multiple hops.'
  }
];

const documentAiToolSelectionSchema = z
  .array(documentAiToolIdSchema)
  .superRefine((tools, context) => {
    if (new Set(tools).size !== tools.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'AI action tools must be unique' });
    }
  });

const documentAiActionBaseSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  prompt: z.string().min(1),
  enabled: z.boolean().default(true),
  // Omitted means the standard read-only tool set for backwards compatibility; [] means no tools.
  tools: documentAiToolSelectionSchema.optional()
});

export const documentAiActionSchema = z.discriminatedUnion('kind', [
  documentAiActionBaseSchema.extend({
    kind: z.literal('interactive')
  }),
  documentAiActionBaseSchema.extend({
    kind: z.literal('metadata_generator'),
    outputFieldId: z.string().min(1)
  })
]);

// Generalized external-field metadata shape (source, timestamp, status, explanation, findings,
// sourceVersion, requestId), with the AI-specific extras (actionId, sourceRevision,
// generatorVersion) retained as optional fields for document AI metadata generation.
export const documentGeneratedMetadataResultSchema = externalMetadataResultSchema;

export const documentGeneratedMetadataSchema = externalMetadataSchema;

export const documentTypeSchema = z.object({
  id: z.string(),
  workspace: z.string(),
  name: z.string(),
  description: z.string(),
  fields: z.array(documentFieldSchema),
  color: z.string().nullable(),
  icon: z.string().nullable(),
  archived: z.boolean(),
  version: z.number().int().min(1).describe('Current document type version number'),
  aiActions: z.array(documentAiActionSchema).default([]),
  created_at: z.string(),
  updated_at: z.string()
});

const fieldMigrationActionSchema = z
  .object({
    action: z.enum(['rename', 'remove', 'archive']).describe('Migration action for this field'),
    renameTo: z.string().optional().describe('New field id when action is "rename"')
  })
  .describe('How to migrate a changed/removed field');

const documentTypeVersionSchema = z.object({
  version: z.number().int().min(1).describe('Version number'),
  name: z.string().describe('Document type name at this version'),
  description: z.string().describe('Document type description at this version'),
  fields: z.array(documentFieldSchema).describe('Field definitions at this version'),
  color: z.string().nullable().describe('Document type color at this version'),
  icon: z.string().nullable().describe('Document type icon at this version'),
  aiActions: z.array(documentAiActionSchema).default([]),
  changeSummary: z
    .record(z.string(), z.unknown())
    .describe('Summary of what changed relative to the previous version'),
  createdBy: z.string().nullable().describe('User id who made this change'),
  createdAt: z.string().describe('ISO 8601 timestamp of this version')
});

export const documentTemplateSchema = z.object({
  id: z.string(),
  workspace: z.string(),
  project_id: z.string().nullable(),
  name: z.string(),
  body: z.string(),
  document_type_id: z.string(),
  metadata_defaults: documentMetadataSchema,
  archived: z.boolean(),
  created_at: z.string(),
  updated_at: z.string()
});

const documentTypeWriteSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(''),
  fields: z.array(documentFieldSchema),
  color: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  aiActions: z.array(documentAiActionSchema).optional(),
  fieldMigrations: z
    .record(z.string(), fieldMigrationActionSchema)
    .optional()
    .describe(
      'Resolutions for fields being renamed/removed/archived while data exists, keyed by the old field id'
    )
});

const documentTemplateWriteSchema = z.object({
  name: z.string().min(1),
  body: z.string(),
  document_type_id: z.string().min(1),
  metadata_defaults: documentMetadataSchema.default({}),
  project_id: z.string().nullable().optional()
});

export const documentContract = oc.tag('Typed Documents').router({
  documentTypes: {
    list: oc
      .route({
        method: 'GET',
        path: '/{workspace}/document-types',
        inputStructure: 'detailed',
        summary: 'List document types',
        tags: ['Typed Documents']
      })
      .input(z.object({ params: ws, query: z.object({ include_archived: booleanQuerySchema }) }))
      .output(z.array(documentTypeSchema)),
    get: oc
      .route({
        method: 'GET',
        path: '/{workspace}/document-types/{id}',
        inputStructure: 'detailed',
        summary: 'Get a document type',
        tags: ['Typed Documents']
      })
      .input(z.object({ params: wsAndId }))
      .output(documentTypeSchema),
    create: oc
      .route({
        method: 'POST',
        path: '/{workspace}/document-types',
        inputStructure: 'detailed',
        summary: 'Create a document type',
        tags: ['Typed Documents']
      })
      .input(z.object({ params: ws, body: documentTypeWriteSchema }))
      .output(documentTypeSchema),
    update: oc
      .route({
        method: 'PUT',
        path: '/{workspace}/document-types/{id}',
        inputStructure: 'detailed',
        summary: 'Update a document type',
        tags: ['Typed Documents']
      })
      .input(z.object({ params: wsAndId, body: documentTypeWriteSchema }))
      .output(documentTypeSchema),
    archive: oc
      .route({
        method: 'POST',
        path: '/{workspace}/document-types/{id}/archive',
        inputStructure: 'detailed',
        summary: 'Archive a document type',
        tags: ['Typed Documents']
      })
      .input(z.object({ params: wsAndId, body: z.object({ archived: z.boolean() }) }))
      .output(documentTypeSchema),
    remove: oc
      .route({
        method: 'DELETE',
        path: '/{workspace}/document-types/{id}',
        inputStructure: 'detailed',
        summary: 'Delete an unused document type',
        tags: ['Typed Documents']
      })
      .input(z.object({ params: wsAndId }))
      .output(z.object({ deleted: z.boolean() })),
    listVersions: oc
      .route({
        method: 'GET',
        path: '/{workspace}/document-types/{id}/versions',
        inputStructure: 'detailed',
        summary: 'List document type version history',
        description:
          'Retrieves the version history for a document type, newest first, including who changed what and when.',
        tags: ['Typed Documents']
      })
      .input(z.object({ params: wsAndId }))
      .output(z.array(documentTypeVersionSchema))
  },
  documentTemplates: {
    list: oc
      .route({
        method: 'GET',
        path: '/{workspace}/document-templates',
        inputStructure: 'detailed',
        summary: 'List document templates',
        tags: ['Typed Documents']
      })
      .input(
        z.object({
          params: ws,
          query: z.object({
            project_id: z.string().nullable().optional(),
            include_archived: booleanQuerySchema
          })
        })
      )
      .output(z.array(documentTemplateSchema)),
    create: oc
      .route({
        method: 'POST',
        path: '/{workspace}/document-templates',
        inputStructure: 'detailed',
        summary: 'Create a document template',
        tags: ['Typed Documents']
      })
      .input(z.object({ params: ws, body: documentTemplateWriteSchema }))
      .output(documentTemplateSchema),
    update: oc
      .route({
        method: 'PUT',
        path: '/{workspace}/document-templates/{id}',
        inputStructure: 'detailed',
        summary: 'Update a document template',
        tags: ['Typed Documents']
      })
      .input(z.object({ params: wsAndId, body: documentTemplateWriteSchema }))
      .output(documentTemplateSchema),
    archive: oc
      .route({
        method: 'POST',
        path: '/{workspace}/document-templates/{id}/archive',
        inputStructure: 'detailed',
        summary: 'Archive a document template',
        tags: ['Typed Documents']
      })
      .input(z.object({ params: wsAndId, body: z.object({ archived: z.boolean() }) }))
      .output(documentTemplateSchema),
    remove: oc
      .route({
        method: 'DELETE',
        path: '/{workspace}/document-templates/{id}',
        inputStructure: 'detailed',
        summary: 'Delete a document template',
        tags: ['Typed Documents']
      })
      .input(z.object({ params: wsAndId }))
      .output(z.object({ deleted: z.boolean() }))
  }
});

export type DocumentFieldType = z.infer<typeof documentFieldTypeSchema>;
export type DocumentRequirement = z.infer<typeof documentRequirementSchema>;
export type DocumentField = z.infer<typeof documentFieldSchema>;
export type DocumentStatusApproval = z.infer<typeof documentStatusApprovalSchema>;
export type DocumentAiAction = z.infer<typeof documentAiActionSchema>;
export type DocumentGeneratedMetadataResult = z.infer<typeof documentGeneratedMetadataResultSchema>;
export type DocumentGeneratedMetadata = z.infer<typeof documentGeneratedMetadataSchema>;
export type DocumentMetadata = z.infer<typeof documentMetadataSchema>;
export type DocumentWorkflowStatus = z.infer<typeof documentWorkflowStatusSchema>;
export type DocumentWorkflowHistoryEvent = z.infer<typeof documentWorkflowHistoryEventSchema>;
export type DocumentType = z.infer<typeof documentTypeSchema>;
export type DocumentTemplate = z.infer<typeof documentTemplateSchema>;
export type DocumentTypeWrite = z.infer<typeof documentTypeWriteSchema>;
export type DocumentTemplateWrite = z.infer<typeof documentTemplateWriteSchema>;

// ── Document Type Versioning & Field Migrations ──────────────

export type FieldMigrationAction = z.infer<typeof fieldMigrationActionSchema>;
export type FieldMigrations = Record<string, FieldMigrationAction>;
export type DocumentTypeVersion = z.infer<typeof documentTypeVersionSchema>;

export type PendingFieldChange = {
  fieldId: string;
  fieldName: string;
  kind: 'removed' | 'renamed';
  renamedToId?: string;
  entityCount: number;
};

export type DocumentTypeMigrationRequiredError = {
  code: 'DOCUMENT_TYPE_MIGRATION_REQUIRED';
  pendingChanges: PendingFieldChange[];
};
