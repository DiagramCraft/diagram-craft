import { oc } from '@orpc/contract';
import { z } from 'zod';
import { ws } from '@arch-register/api-types/common';
import {
  relationCreateBodySchema,
  relationRecordSchema
} from '@arch-register/api-types/relationContract';

export const relationSyncStatusSchema = z.enum(['created', 'updated', 'unchanged']);

const relationSyncResultSchema = z.object({
  status: relationSyncStatusSchema,
  relation: relationRecordSchema
});

export const relationSyncContract = oc.tag('Integrations').router({
  relationSync: {
    getByExternalKey: oc
      .route({
        method: 'GET',
        path: '/integrations/v1/{workspace}/relations/byExternalKey/{source}/{externalKey}',
        inputStructure: 'detailed',
        summary: 'Get relation by external identity',
        description:
          'Retrieves a relation instance identified by a durable (source, externalKey) pair.',
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
      .output(relationRecordSchema),
    syncByExternalKey: oc
      .route({
        method: 'PUT',
        path: '/integrations/v1/{workspace}/relations/byExternalKey/{source}/{externalKey}',
        inputStructure: 'detailed',
        summary: 'Idempotently create or update a relation by its external identity',
        description:
          'Creates or updates a typed relation instance identified by a durable (source, externalKey) ' +
          'pair, converging repeated submissions on the same relation instead of creating duplicates.',
        tags: ['Integrations']
      })
      .input(
        z.object({
          params: ws.extend({
            source: z.string().min(1).max(200),
            externalKey: z.string().min(1).max(500)
          }),
          body: relationCreateBodySchema
        })
      )
      .output(relationSyncResultSchema)
  }
});

export type RelationSyncStatus = z.infer<typeof relationSyncStatusSchema>;
