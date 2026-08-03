import { oc } from '@orpc/contract';
import { z } from 'zod';
import { ws, wsAndId } from '@arch-register/api-types/common';
import {
  deleteRelationResponseSchema,
  entityTypedRelationsSchema,
  relationCreateBodySchema,
  relationListFiltersSchema,
  relationListResponseSchema,
  relationRecordSchema,
  relationUpdateBodySchema
} from './relationContract';
import { relationSchemaSchema } from './relationSchemaContract';

const paginatedRelationQuery = z.object({
  ...relationListFiltersSchema.shape,
  limit: z.preprocess(
    value => (value !== undefined ? Number(value) : undefined),
    z.number().int().positive().optional()
  ),
  offset: z.preprocess(
    value => (value !== undefined ? Number(value) : undefined),
    z.number().int().min(0).optional()
  )
});

export const integrationRelationContract = oc.tag('Integrations').router({
  integrationRelationSchemas: {
    list: oc
      .route({
        method: 'GET',
        path: '/integrations/v1/{workspace}/relation-schemas',
        inputStructure: 'detailed',
        summary: 'List relation schemas for integrations',
        description:
          'Lists typed relation schema metadata, including endpoint constraints, relation fields, ' +
          'field groups, and approval policy.',
        tags: ['Integrations']
      })
      .input(z.object({ params: ws }))
      .output(z.array(relationSchemaSchema)),
    get: oc
      .route({
        method: 'GET',
        path: '/integrations/v1/{workspace}/relation-schemas/{id}',
        inputStructure: 'detailed',
        summary: 'Get relation schema for integrations',
        description: 'Retrieves typed relation schema metadata by identifier.',
        tags: ['Integrations']
      })
      .input(z.object({ params: wsAndId }))
      .output(relationSchemaSchema)
  },
  integrationRelations: {
    list: oc
      .route({
        method: 'GET',
        path: '/integrations/v1/{workspace}/relations',
        inputStructure: 'detailed',
        summary: 'List typed relations for integrations',
        description:
          'Lists typed relation instances with endpoint filters and offset pagination. Restricted ' +
          'relation field values are omitted from the response.',
        tags: ['Integrations']
      })
      .input(z.object({ params: ws, query: paginatedRelationQuery }))
      .output(relationListResponseSchema),
    get: oc
      .route({
        method: 'GET',
        path: '/integrations/v1/{workspace}/relations/{id}',
        inputStructure: 'detailed',
        summary: 'Get a typed relation for integrations',
        description: 'Retrieves one typed relation instance with redacted field values.',
        tags: ['Integrations']
      })
      .input(z.object({ params: wsAndId }))
      .output(relationRecordSchema),
    create: oc
      .route({
        method: 'POST',
        path: '/integrations/v1/{workspace}/relations',
        inputStructure: 'detailed',
        summary: 'Create a typed relation for integrations',
        description: 'Creates a typed relation instance between two endpoint entities.',
        tags: ['Integrations']
      })
      .input(z.object({ params: ws, body: relationCreateBodySchema }))
      .output(relationRecordSchema),
    update: oc
      .route({
        method: 'PUT',
        path: '/integrations/v1/{workspace}/relations/{id}',
        inputStructure: 'detailed',
        summary: 'Update a typed relation for integrations',
        description: 'Updates typed relation field values; endpoints are immutable.',
        tags: ['Integrations']
      })
      .input(z.object({ params: wsAndId, body: relationUpdateBodySchema }))
      .output(relationRecordSchema),
    remove: oc
      .route({
        method: 'DELETE',
        path: '/integrations/v1/{workspace}/relations/{id}',
        inputStructure: 'detailed',
        summary: 'Delete a typed relation for integrations',
        description: 'Deletes a typed relation instance.',
        tags: ['Integrations']
      })
      .input(z.object({ params: wsAndId }))
      .output(deleteRelationResponseSchema),
    listForEntity: oc
      .route({
        method: 'GET',
        path: '/integrations/v1/{workspace}/data/{id}/typed-relations',
        inputStructure: 'detailed',
        summary: 'List typed relations for an entity for integrations',
        description: 'Lists visible typed relations where the entity is either endpoint.',
        tags: ['Integrations']
      })
      .input(z.object({ params: wsAndId }))
      .output(entityTypedRelationsSchema)
  }
});
