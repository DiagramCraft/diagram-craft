import { oc } from '@orpc/contract';
import { z } from 'zod';
import { fieldMigrationsSchema, ws } from '@arch-register/api-types/common';

export const schemaDraftKindSchema = z
  .enum(['entity_schema', 'relation_schema', 'document_type', 'enum', 'field_group', 'category'])
  .describe('Kind of schema definition a draft item changes');

export const schemaDraftOpSchema = z
  .enum(['create', 'update', 'delete'])
  .describe('Operation the draft item applies on publish');

export const schemaChangeModeSchema = z
  .enum(['direct', 'draft'])
  .describe('Whether schema edits go live immediately (direct) or must be staged in the draft');

const expectedRevisionSchema = z
  .number()
  .int()
  .min(0)
  .describe('Draft revision the caller last saw; 0 when no draft exists. Mismatch returns 409.');

export const schemaDraftItemSchema = z.object({
  kind: schemaDraftKindSchema,
  item_id: z
    .string()
    .describe('Id of the live item this entry changes (client-generated for create)'),
  op: schemaDraftOpSchema,
  payload: z.unknown().nullable().describe('Staged create/update body; null for delete'),
  base_version: z
    .string()
    .nullable()
    .describe('Live version of the item when it was first staged; null for create'),
  updated_by: z.string().nullable(),
  updated_at: z.string().describe('ISO 8601 timestamp')
});

export const schemaDraftSchema = z.object({
  revision: z.number().int().describe('Current draft revision; 0 when no draft exists'),
  created_by: z.string().nullable(),
  updated_by: z.string().nullable(),
  created_at: z.string().nullable(),
  updated_at: z.string().nullable(),
  items: z.array(schemaDraftItemSchema)
});

const migrationChangeSchema = z.object({
  fieldId: z.string(),
  fieldName: z.string(),
  kind: z.enum(['removed', 'renamed', 'type-changed', 'newly-required']),
  renamedToId: z.string().optional(),
  recordCount: z.number().int().describe('Records with a value in the field'),
  decision: z.enum(['rename', 'remove', 'archive']).optional()
});

export const schemaPublicationSchema = z.object({
  id: z.string(),
  number: z.number().int().describe('Sequential publication number within the workspace'),
  summary: z.string(),
  author: z.string().nullable(),
  publishedAt: z.string().describe('ISO 8601 timestamp'),
  items: z.array(
    z.object({
      kind: schemaDraftKindSchema,
      itemId: z.string(),
      op: schemaDraftOpSchema,
      name: z.string().nullable().describe('Name of the item as published; null for delete')
    })
  ),
  migrationDetails: z.array(
    z.object({
      kind: schemaDraftKindSchema,
      itemId: z.string(),
      name: z.string(),
      recordCount: z.number().int(),
      fieldMigrations: fieldMigrationsSchema.nullable(),
      changes: z.array(migrationChangeSchema)
    })
  )
});

export const publishSchemaDraftBodySchema = z.object({
  expectedRevision: expectedRevisionSchema,
  summary: z.string().trim().min(1).max(2000).describe('What this publication changes'),
  migrationDecisions: z
    .array(
      z.object({
        kind: schemaDraftKindSchema,
        itemId: z.string().min(1),
        fieldMigrations: fieldMigrationsSchema
      })
    )
    .default([])
    .describe('Field migration decisions, overriding any staged on the draft item')
});

export const schemaSnapshotVersionSchema = z.object({
  version: z.number().int(),
  snapshot: z.unknown().describe('The item as it was at this version'),
  changeSummary: z.string().nullable(),
  publicationId: z.string().nullable(),
  createdBy: z.string().nullable(),
  createdAt: z.string().describe('ISO 8601 timestamp')
});

export const snapshotVersionKindSchema = z.enum(['enum', 'field_group', 'category']);

export const schemaDraftReviewSchema = z.object({
  revision: z.number().int().describe('Draft revision the review was computed for'),
  items: z.array(
    z.object({
      kind: schemaDraftKindSchema,
      itemId: z.string(),
      op: schemaDraftOpSchema,
      name: z.string().nullable().describe('Name after the draft is applied'),
      liveName: z.string().nullable().describe('Current live name; null for create')
    })
  ),
  migrations: z.array(
    z.object({
      kind: schemaDraftKindSchema,
      itemId: z.string(),
      name: z.string(),
      recordCount: z.number().int(),
      hardBlocks: z.array(migrationChangeSchema.extend({ message: z.string() })),
      unresolved: z.array(migrationChangeSchema),
      resolved: z.array(migrationChangeSchema)
    })
  ),
  findings: z.array(
    z.object({
      severity: z.enum(['blocking', 'warning']),
      category: z.string(),
      draftItem: z.object({
        kind: schemaDraftKindSchema,
        itemId: z.string(),
        name: z.string().nullable()
      }),
      subject: z.object({ type: z.string(), id: z.string(), name: z.string() }),
      message: z.string()
    })
  ),
  recordValidation: z
    .object({ jobRunId: z.string() })
    .describe('Background job validating existing records; poll reviewRecords for the result'),
  summary: z.object({
    blocking: z.number().int(),
    warnings: z.number().int(),
    unresolvedMigrations: z.number().int(),
    hardBlockedMigrations: z.number().int()
  })
});

const recordProblemGroupSchema = z.object({
  schemaId: z.string(),
  schemaName: z.string(),
  recordType: z.enum(['entity', 'relation']),
  fieldId: z.string().nullable(),
  fieldName: z.string().nullable(),
  problem: z.enum([
    'schema_deleted',
    'required_missing',
    'invalid_option',
    'endpoint_not_allowed',
    'validation_rule'
  ]),
  count: z.number().int(),
  examples: z.array(z.object({ recordId: z.string(), message: z.string() }))
});

export const schemaDraftRecordReviewSchema = z.object({
  status: z.enum(['queued', 'running', 'succeeded', 'failed', 'cancelled']),
  error: z.string().nullable(),
  stale: z.boolean().describe('True when the draft changed after the job was enqueued'),
  revision: z.number().int(),
  entitiesChecked: z.number().int(),
  relationsChecked: z.number().int(),
  problemCount: z.number().int(),
  groups: z.array(recordProblemGroupSchema)
});

const itemParams = ws.extend({ kind: schemaDraftKindSchema, itemId: z.string().min(1) });

export const workspaceSchemaDraftContract = oc.tag('Schema Draft').router({
  schemaDraft: {
    get: oc
      .route({
        method: 'GET',
        path: '/{workspace}/schema-draft',
        inputStructure: 'detailed',
        summary: 'Get the workspace schema draft',
        description: 'Returns the single shared draft (revision 0 and no items when none exists).',
        tags: ['Schema Draft']
      })
      .input(z.object({ params: ws }))
      .output(schemaDraftSchema),
    stage: oc
      .route({
        method: 'PUT',
        path: '/{workspace}/schema-draft/items/{kind}/{itemId}',
        inputStructure: 'detailed',
        summary: 'Stage a schema change',
        description:
          'Adds or replaces a draft item. Never changes live definitions. Returns 409 when expectedRevision is stale.',
        tags: ['Schema Draft']
      })
      .input(
        z.object({
          params: itemParams,
          body: z.object({
            expectedRevision: expectedRevisionSchema,
            op: schemaDraftOpSchema,
            payload: z.unknown().optional()
          })
        })
      )
      .output(schemaDraftSchema),
    unstage: oc
      .route({
        method: 'DELETE',
        path: '/{workspace}/schema-draft/items/{kind}/{itemId}',
        inputStructure: 'detailed',
        summary: 'Unstage a schema change',
        description: 'Removes an item from the draft. Returns 409 when expectedRevision is stale.',
        tags: ['Schema Draft']
      })
      .input(
        z.object({
          params: itemParams,
          query: z.object({ expectedRevision: z.coerce.number().int().min(0) })
        })
      )
      .output(schemaDraftSchema),
    discard: oc
      .route({
        method: 'DELETE',
        path: '/{workspace}/schema-draft',
        inputStructure: 'detailed',
        summary: 'Discard the schema draft',
        description: 'Deletes the draft and all items. Returns 409 when expectedRevision is stale.',
        tags: ['Schema Draft']
      })
      .input(
        z.object({
          params: ws,
          query: z.object({ expectedRevision: z.coerce.number().int().min(0) })
        })
      )
      .output(z.object({ success: z.boolean() })),
    review: oc
      .route({
        method: 'POST',
        path: '/{workspace}/schema-draft/review',
        inputStructure: 'detailed',
        summary: 'Review the impact of the schema draft',
        description:
          'Computes a draft catalog overlay and reports required migrations, blocking conflicts and warnings. Read-only: never changes live definitions or data.',
        tags: ['Schema Draft']
      })
      .input(z.object({ params: ws }))
      .output(schemaDraftReviewSchema),
    reviewRecords: oc
      .route({
        method: 'GET',
        path: '/{workspace}/schema-draft/review/records/{jobRunId}',
        inputStructure: 'detailed',
        summary: 'Get record validation results for a draft review',
        tags: ['Schema Draft']
      })
      .input(z.object({ params: ws.extend({ jobRunId: z.string().min(1) }) }))
      .output(schemaDraftRecordReviewSchema),
    publish: oc
      .route({
        method: 'POST',
        path: '/{workspace}/schema-draft/publish',
        inputStructure: 'detailed',
        summary: 'Publish the schema draft',
        description:
          'Atomically applies every draft item to the live catalog and records a publication. Requires schema.publish. Returns 409 when the draft revision is stale, a live item changed after it was staged, or unresolved migrations / blocking conflicts remain; nothing is applied in that case.',
        tags: ['Schema Draft']
      })
      .input(z.object({ params: ws, body: publishSchemaDraftBodySchema }))
      .output(schemaPublicationSchema),
    fromVersion: oc
      .route({
        method: 'POST',
        path: '/{workspace}/schema-draft/from-version',
        inputStructure: 'detailed',
        summary: 'Stage a rollback to a previous published version',
        description:
          'Stages an update (or create, when the item no longer exists) that restores the item to a previous version. Data migrations are not reversed.',
        tags: ['Schema Draft']
      })
      .input(
        z.object({
          params: ws,
          body: z.object({
            expectedRevision: expectedRevisionSchema,
            kind: schemaDraftKindSchema,
            itemId: z.string().min(1),
            version: z.number().int().min(1)
          })
        })
      )
      .output(schemaDraftSchema),
    getMode: oc
      .route({
        method: 'GET',
        path: '/{workspace}/schema-draft/mode',
        inputStructure: 'detailed',
        summary: 'Get the schema change mode',
        tags: ['Schema Draft']
      })
      .input(z.object({ params: ws }))
      .output(z.object({ schemaChangeMode: schemaChangeModeSchema })),
    setMode: oc
      .route({
        method: 'PUT',
        path: '/{workspace}/schema-draft/mode',
        inputStructure: 'detailed',
        summary: 'Set the schema change mode',
        tags: ['Schema Draft']
      })
      .input(z.object({ params: ws, body: z.object({ schemaChangeMode: schemaChangeModeSchema }) }))
      .output(z.object({ schemaChangeMode: schemaChangeModeSchema }))
  },
  schemaPublication: {
    list: oc
      .route({
        method: 'GET',
        path: '/{workspace}/schema-publications',
        inputStructure: 'detailed',
        summary: 'List schema publications',
        tags: ['Schema Draft']
      })
      .input(z.object({ params: ws }))
      .output(z.array(schemaPublicationSchema)),
    get: oc
      .route({
        method: 'GET',
        path: '/{workspace}/schema-publications/{number}',
        inputStructure: 'detailed',
        summary: 'Get a schema publication',
        tags: ['Schema Draft']
      })
      .input(z.object({ params: ws.extend({ number: z.coerce.number().int().min(1) }) }))
      .output(schemaPublicationSchema)
  },
  schemaSnapshotVersion: {
    list: oc
      .route({
        method: 'GET',
        path: '/{workspace}/schema-versions/{kind}/{itemId}',
        inputStructure: 'detailed',
        summary: 'List published versions of an enum, field group or category',
        tags: ['Schema Draft']
      })
      .input(
        z.object({
          params: ws.extend({ kind: snapshotVersionKindSchema, itemId: z.string().min(1) })
        })
      )
      .output(z.array(schemaSnapshotVersionSchema))
  }
});

export type SchemaDraft = z.infer<typeof schemaDraftSchema>;
export type SchemaDraftItem = z.infer<typeof schemaDraftItemSchema>;
export type SchemaDraftKind = z.infer<typeof schemaDraftKindSchema>;
export type SchemaDraftOp = z.infer<typeof schemaDraftOpSchema>;
export type SchemaChangeMode = z.infer<typeof schemaChangeModeSchema>;
export type SnapshotVersionKind = z.infer<typeof snapshotVersionKindSchema>;
export type SchemaDraftRecordReview = z.infer<typeof schemaDraftRecordReviewSchema>;
export type SchemaDraftReview = z.infer<typeof schemaDraftReviewSchema>;
export type SchemaPublication = z.infer<typeof schemaPublicationSchema>;
export type SchemaSnapshotVersion = z.infer<typeof schemaSnapshotVersionSchema>;
export type PublishSchemaDraftBody = z.infer<typeof publishSchemaDraftBodySchema>;
