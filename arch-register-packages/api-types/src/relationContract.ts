import { oc } from '@orpc/contract';
import { z } from 'zod';
import { ws, wsAndId, foreignKeySchema } from '@arch-register/api-types/common';

// ── Relation instance ────────────────────────────────────────

const relationCapabilitiesSchema = z.object({
  canView: z.boolean().describe('Whether the user can view this relation instance'),
  canEdit: z.boolean().describe('Whether the user can edit this relation instance'),
  canDelete: z.boolean().describe('Whether the user can delete this relation instance')
});

const relationSummarySchema = relationCapabilitiesSchema.extend({
  _uid: z.string().describe('Unique relation instance identifier'),
  _schema: foreignKeySchema.describe('Relation schema reference'),
  _in: foreignKeySchema.describe('The "in" endpoint entity'),
  _out: foreignKeySchema.describe('The "out" endpoint entity'),
  _version: z.number().int().min(1).describe('Optimistic concurrency version'),
  _createdAt: z.string().describe('ISO 8601 creation timestamp'),
  _updatedAt: z.string().describe('ISO 8601 last update timestamp')
});

// RelationRecord = RelationSummary + dynamic schema fields
export const relationRecordSchema = relationSummarySchema
  .catchall(z.unknown())
  .describe('Complete relation instance record with schema-specific fields');

// ── Mutation input ────────────────────────────────────────────

export const relationCreateBodySchema = z
  .object({
    _schemaId: z.string().describe('Relation schema identifier'),
    _inEntityId: z.string().describe('Identifier of the entity at the "in" endpoint'),
    _outEntityId: z.string().describe('Identifier of the entity at the "out" endpoint')
  })
  .catchall(z.unknown())
  .describe('Relation instance creation data with schema-specific fields');

export const relationUpdateBodySchema = z
  .object({})
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

const relationListResponseSchema = z.object({
  items: z.array(relationRecordSchema).describe('Relation instances on the requested page'),
  total: z.number().int().describe('Total number of relation instances matching the filters')
});

const deleteRelationResponseSchema = z.object({
  success: z.boolean().describe('Whether the deletion was successful'),
  message: z.string().describe('Status message or error details')
});

// ── Typed relations for an entity ─────────────────────────────

const entityTypedRelationsSchema = z.object({
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
        description: 'Permanently deletes a relation instance. This operation cannot be undone.',
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
export type EntityTypedRelations = z.infer<typeof entityTypedRelationsSchema>;
