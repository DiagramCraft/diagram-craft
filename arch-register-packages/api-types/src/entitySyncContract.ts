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
