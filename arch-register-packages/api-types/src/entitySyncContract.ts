import { oc } from '@orpc/contract';
import { z } from 'zod';
import { ws } from '@arch-register/api-types/common';
import {
  entityMutationBodySchema,
  entityRecordSchema
} from '@arch-register/api-types/entityContract';

export const entitySyncStatusSchema = z.enum(['created', 'updated', 'unchanged']);

const entitySyncResultSchema = z.object({
  status: entitySyncStatusSchema,
  entity: entityRecordSchema
});

export const entitySyncContract = oc.tag('Integrations').router({
  entitySync: {
    getById: oc
      .route({
        method: 'GET',
        path: '/integrations/v1/{workspace}/entities/{id}',
        inputStructure: 'detailed',
        summary: 'Get entity by ID',
        description: 'Retrieves an entity by its unique identifier.',
        tags: ['Integrations']
      })
      .input(
        z.object({
          params: ws.extend({
            id: z.string()
          })
        })
      )
      .output(entityRecordSchema),
    updateById: oc
      .route({
        method: 'PUT',
        path: '/integrations/v1/{workspace}/entities/{id}',
        inputStructure: 'detailed',
        summary: 'Update entity by ID',
        description: 'Updates an existing entity identified by its unique identifier.',
        tags: ['Integrations']
      })
      .input(
        z.object({
          params: ws.extend({
            id: z.string()
          }),
          body: entityMutationBodySchema
        })
      )
      .output(entityRecordSchema),
    getByExternalKey: oc
      .route({
        method: 'GET',
        path: '/integrations/v1/{workspace}/entities/byExternalKey/{source}/{externalKey}',
        inputStructure: 'detailed',
        summary: 'Get entity by external identity',
        description:
          'Retrieves an entity identified by a durable (source, externalKey) pair.',
        tags: ['Integrations']
      })
      .input(
        z.object({
          params: ws.extend({
            source: z.string().min(1).max(200),
            externalKey: z.string().min(1).max(500)
          })
        })
      )
      .output(entityRecordSchema),
    syncByExternalKey: oc
      .route({
        method: 'PUT',
        path: '/integrations/v1/{workspace}/entities/byExternalKey/{source}/{externalKey}',
        inputStructure: 'detailed',
        summary: 'Idempotently create or update an entity by its external identity',
        description:
          'Creates or updates an entity identified by a durable (source, externalKey) pair, ' +
          'converging repeated submissions on the same entity instead of creating duplicates.',
        tags: ['Integrations']
      })
      .input(
        z.object({
          params: ws.extend({
            source: z.string().min(1).max(200),
            externalKey: z.string().min(1).max(500)
          }),
          body: entityMutationBodySchema
        })
      )
      .output(entitySyncResultSchema)
  }
});

export type EntitySyncStatus = z.infer<typeof entitySyncStatusSchema>;
