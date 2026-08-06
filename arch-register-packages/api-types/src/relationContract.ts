import { oc } from '@orpc/contract';
import { z } from 'zod';
import {
  ws,
  wsAndId,
  foreignKeySchema,
  externalMetadataSchema
} from '@arch-register/api-types/common';
import { entityQuerySchema } from '@arch-register/api-types/entityQueryIR';

// ── Relation instance ────────────────────────────────────────

const relationCapabilitiesSchema = z.object({
  canView: z.boolean().describe('Whether the user can view this relation instance'),
  canEdit: z.boolean().describe('Whether the user can edit this relation instance'),
  canDelete: z.boolean().describe('Whether the user can delete this relation instance'),
  canAdmin: z.boolean().describe('Whether the user can manage relation ownership')
});

const relationSummarySchema = relationCapabilitiesSchema.extend({
  _uid: z.string().describe('Unique relation instance identifier'),
  _schema: foreignKeySchema.describe('Relation schema reference'),
  _in: foreignKeySchema.describe('The "in" endpoint entity'),
  _out: foreignKeySchema.describe('The "out" endpoint entity'),
  _owner: foreignKeySchema.nullable().describe('Relation owner'),
  _lifecycle: foreignKeySchema.nullable().describe('Current lifecycle state'),
  _version: z.number().int().min(1).describe('Optimistic concurrency version'),
  _createdAt: z.string().describe('ISO 8601 creation timestamp'),
  _updatedAt: z.string().describe('ISO 8601 last update timestamp'),
  _externalMetadata: externalMetadataSchema
    .optional()
    .describe('Latest external-update metadata, keyed by field id, for external_kind fields')
});

// RelationRecord = RelationSummary + dynamic schema fields
export const relationRecordSchema = relationSummarySchema
  .catchall(z.unknown())
  .describe('Complete relation instance record with schema-specific fields');

// ── Mutation input ────────────────────────────────────────────

const relationOwnerOrIdSchema = z
  .union([z.string(), z.object({ id: z.string() }).passthrough()])
  .nullable()
  .optional()
  .describe('Owner reference (ID string or object with id)');

export const relationCreateBodySchema = z
  .object({
    _schemaId: z.string().describe('Relation schema identifier'),
    _inEntityId: z.string().describe('Identifier of the entity at the "in" endpoint'),
    _outEntityId: z.string().describe('Identifier of the entity at the "out" endpoint'),
    // Optional — omit to default-copy from the "in" entity's current owner/lifecycle (#2708).
    _owner: relationOwnerOrIdSchema.describe(
      'Relation owner (defaults to the "in" entity\'s owner)'
    ),
    _lifecycle: relationOwnerOrIdSchema.describe(
      'Current lifecycle state (defaults to the "in" entity\'s lifecycle)'
    )
  })
  .catchall(z.unknown())
  .describe('Relation instance creation data with schema-specific fields');

export const relationUpdateBodySchema = z
  .object({
    _owner: relationOwnerOrIdSchema.describe('Relation owner'),
    _lifecycle: relationOwnerOrIdSchema.describe('Current lifecycle state')
  })
  .catchall(z.unknown())
  .describe(
    'Relation instance update data with schema-specific fields; the "in"/"out" endpoints are ' +
      'immutable after creation'
  );

// ── List / filter input ──────────────────────────────────────

export const relationListFiltersSchema = z.object({
  schemaId: z.string().optional().describe('Filter by relation schema identifier'),
  inEntityId: z.string().optional().describe('Filter by "in" endpoint entity identifier'),
  outEntityId: z.string().optional().describe('Filter by "out" endpoint entity identifier')
});

export const relationListResponseSchema = z.object({
  items: z.array(relationRecordSchema).describe('Relation instances on the requested page'),
  total: z.number().int().describe('Total number of relation instances matching the filters')
});

// ── Relation-rooted structured query (#2689) ─────────────────
//
// Additive endpoint: reuses the same EntityQuery IR/DSL as entity querying (see
// entityQueryIR.ts), scoped to a relation schema so its root kind resolves to 'relation'. Does
// not change the `list`/`get`/`create`/`update`/`remove`/`listForEntity` endpoints above, which
// keep serving the existing entity-embedded relation UX unchanged.
const relationQueryRequestSchema = z.preprocess(value => {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}, entityQuerySchema);

const relationCsvExportQuerySchema = z.object({
  relationQuery: relationQueryRequestSchema.describe(
    'Structured relation-rooted query serialized as JSON when sent as a GET query parameter'
  )
});

const relationImportRowSchema = z.object({
  rowNumber: z.number().int(),
  errors: z.array(z.string()),
  relation: z.record(z.string(), z.unknown()).nullable(),
  isUpdate: z.boolean(),
  existingId: z.string().optional(),
  matchType: z.enum(['natural-key', 'none']).optional()
});

const relationImportParseResponseSchema = z.object({
  totalRows: z.number().int(),
  validRows: z.number().int(),
  relations: z.array(relationImportRowSchema)
});

const relationImportCommitResponseSchema = z.object({
  created: z.number().int(),
  updated: z.number().int(),
  ids: z.array(z.string())
});

export const relationQueryListFiltersSchema = z.object({
  relationQuery: relationQueryRequestSchema.describe(
    'Structured EntityQuery IR rooted at a relation schema, serialized as JSON when sent as a GET query parameter'
  ),
  view: z.enum(['summary', 'full']).optional().describe('Response detail level'),
  limit: z.preprocess(
    v => (v !== undefined ? Number(v) : undefined),
    z.number().int().positive().optional().describe('Maximum number of relations to return')
  ),
  offset: z.preprocess(
    v => (v !== undefined ? Number(v) : undefined),
    z.number().int().min(0).optional().describe('Number of relations to skip for pagination')
  )
});

export const deleteRelationResponseSchema = z.object({
  success: z.boolean().describe('Whether the deletion was successful'),
  message: z.string().describe('Status message or error details')
});

// ── Typed relations for an entity ─────────────────────────────

export const entityTypedRelationsSchema = z.object({
  outgoing: z
    .array(relationRecordSchema)
    .describe('Relation instances where this entity is the "in" endpoint'),
  incoming: z
    .array(relationRecordSchema)
    .describe('Relation instances where this entity is the "out" endpoint')
});

// ── Contract ──────────────────────────────────────────────────

export const workspaceRelationContract = oc.tag('Relations').router({
  relations: {
    list: oc
      .route({
        method: 'GET',
        path: '/{workspace}/relations',
        inputStructure: 'detailed',
        summary: 'List relation instances',
        description:
          'Retrieves typed relation instances with optional filtering by schema and endpoint entity.',
        tags: ['Relations']
      })
      .input(
        z.object({
          params: ws,
          query: z.object({
            ...relationListFiltersSchema.shape,
            limit: z.preprocess(
              v => (v !== undefined ? Number(v) : undefined),
              z
                .number()
                .int()
                .positive()
                .optional()
                .describe('Maximum number of relations to return')
            ),
            offset: z.preprocess(
              v => (v !== undefined ? Number(v) : undefined),
              z
                .number()
                .int()
                .min(0)
                .optional()
                .describe('Number of relations to skip for pagination')
            )
          })
        })
      )
      .output(relationListResponseSchema),
    query: oc
      .route({
        method: 'GET',
        path: '/{workspace}/relations/query',
        inputStructure: 'detailed',
        summary: 'Query relation instances',
        description:
          'Lists relation instances via the structured EntityQuery IR, rooted at a relation ' +
          'schema — supports filtering, sorting, search-free-field predicates, and projections, ' +
          'unlike the simpler schema/endpoint-only filters on GET /{workspace}/relations.',
        tags: ['Relations']
      })
      .input(z.object({ params: ws, query: relationQueryListFiltersSchema }))
      .output(relationListResponseSchema),
    exportCsv: oc
      .route({
        method: 'GET',
        path: '/{workspace}/relations/export',
        inputStructure: 'detailed',
        outputStructure: 'detailed',
        summary: 'Export relations to CSV',
        description: 'Exports relation instances matching a structured relation query to CSV.',
        tags: ['Relations']
      })
      .input(z.object({ params: ws, query: relationCsvExportQuerySchema }))
      .output(
        z.object({
          headers: z.record(z.string(), z.string()),
          body: z.instanceof(Blob)
        })
      ),
    importParse: oc
      .route({
        method: 'POST',
        path: '/{workspace}/relations/import/parse',
        inputStructure: 'detailed',
        summary: 'Parse relation import CSV',
        description: 'Validates and previews relation instances from a CSV file.',
        tags: ['Relations']
      })
      .input(
        z.object({
          params: ws,
          body: z.object({ csvContent: z.string().describe('CSV file content') })
        })
      )
      .output(relationImportParseResponseSchema),
    importCommit: oc
      .route({
        method: 'POST',
        path: '/{workspace}/relations/import/commit',
        inputStructure: 'detailed',
        summary: 'Commit relation import',
        description: 'Creates or updates relation instances from parsed CSV rows.',
        tags: ['Relations']
      })
      .input(
        z.object({
          params: ws,
          body: z.object({
            relations: z
              .array(z.record(z.string(), z.unknown()))
              .describe('Relation rows to import')
          })
        })
      )
      .output(relationImportCommitResponseSchema),
    downloadTemplate: oc
      .route({
        method: 'GET',
        path: '/{workspace}/relations/import/template/{id}',
        inputStructure: 'detailed',
        outputStructure: 'detailed',
        summary: 'Download relation import template',
        description: 'Downloads a CSV template for a relation schema.',
        tags: ['Relations']
      })
      .input(z.object({ params: wsAndId }))
      .output(
        z.object({
          headers: z.record(z.string(), z.string()),
          body: z.instanceof(Blob)
        })
      ),
    get: oc
      .route({
        method: 'GET',
        path: '/{workspace}/relations/{id}',
        inputStructure: 'detailed',
        summary: 'Get relation instance details',
        description: 'Retrieves complete details for a specific relation instance.',
        tags: ['Relations']
      })
      .input(z.object({ params: wsAndId }))
      .output(relationRecordSchema),
    create: oc
      .route({
        method: 'POST',
        path: '/{workspace}/relations',
        inputStructure: 'detailed',
        summary: 'Create relation instance',
        description:
          'Creates a new typed relation instance between two entities. The endpoint entities must match ' +
          'the schemas allowed by the relation schema\'s "in"/"out" endpoint constraints.',
        tags: ['Relations']
      })
      .input(z.object({ params: ws, body: relationCreateBodySchema }))
      .output(relationRecordSchema),
    update: oc
      .route({
        method: 'PUT',
        path: '/{workspace}/relations/{id}',
        inputStructure: 'detailed',
        summary: 'Update relation instance',
        description:
          'Updates the field values of an existing relation instance. The "in"/"out" endpoints cannot be ' +
          'changed; delete and recreate the relation instead.',
        tags: ['Relations']
      })
      .input(z.object({ params: wsAndId, body: relationUpdateBodySchema }))
      .output(relationRecordSchema),
    remove: oc
      .route({
        method: 'DELETE',
        path: '/{workspace}/relations/{id}',
        inputStructure: 'detailed',
        summary: 'Delete relation instance',
        description:
          'Deletes a relation instance. The instance and its version history are retained ' +
          'internally but no longer visible or resolvable through any relation API.',
        tags: ['Relations']
      })
      .input(z.object({ params: wsAndId }))
      .output(deleteRelationResponseSchema),
    listForEntity: oc
      .route({
        method: 'GET',
        path: '/{workspace}/data/{id}/typed-relations',
        inputStructure: 'detailed',
        summary: 'Get typed relation instances for an entity',
        description:
          'Retrieves all typed relation instances where the given entity participates as the "in" ' +
          '(outgoing) or "out" (incoming) endpoint. Distinct from the generic reference/containment ' +
          'relations returned by GET /{workspace}/data/{id}/relations.',
        tags: ['Relations']
      })
      .input(z.object({ params: wsAndId }))
      .output(entityTypedRelationsSchema)
  }
});

export type RelationRecord = z.infer<typeof relationRecordSchema>;
export type RelationCreateBody = z.infer<typeof relationCreateBodySchema>;
export type RelationUpdateBody = z.infer<typeof relationUpdateBodySchema>;
export type RelationListFilters = z.infer<typeof relationListFiltersSchema>;
export type RelationQueryListFilters = z.infer<typeof relationQueryListFiltersSchema>;
export type EntityTypedRelations = z.infer<typeof entityTypedRelationsSchema>;
