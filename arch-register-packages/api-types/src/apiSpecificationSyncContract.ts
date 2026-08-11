import { oc } from '@orpc/contract';
import { z } from 'zod';
import { ws } from '@arch-register/api-types/common';
import { entityMutationBodySchema, entityRecordSchema } from './entityContract';
import { artifactRevisionSchema, artifactSchema } from './artifactContract';

const externalIdentityParamsSchema = ws.extend({
  source: z.string().min(1).max(200),
  externalKey: z.string().min(1).max(500)
});

export const apiSpecificationSourceKeySchema = z
  .string()
  .min(1)
  .max(1000)
  .describe('Stable provider-scoped source identity; never an internal database identifier');

const sourceRevisionSchema = z.string().max(500).nullable().optional();
const mediaTypeSchema = z.string().max(200).nullable().optional();

export const apiSpecificationSyncSourceSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('document'),
    sourceKey: apiSpecificationSourceKeySchema,
    content: z.string().min(1).max(2_000_000),
    location: z.string().max(2000).nullable().optional(),
    mediaType: mediaTypeSchema,
    sourceRevision: sourceRevisionSchema
  }),
  z.object({
    kind: z.literal('url'),
    sourceKey: apiSpecificationSourceKeySchema,
    location: z.string().min(1).max(2000),
    mediaType: mediaTypeSchema,
    sourceRevision: sourceRevisionSchema,
    refreshPolicy: z
      .discriminatedUnion('mode', [
        z.object({ mode: z.literal('manual') }),
        z.object({
          mode: z.literal('scheduled'),
          intervalHours: z
            .number()
            .int()
            .min(1)
            .max(24 * 365)
        })
      ])
      .optional()
  }),
  z.object({
    kind: z.literal('link'),
    sourceKey: apiSpecificationSourceKeySchema,
    location: z.string().min(1).max(2000),
    mediaType: mediaTypeSchema
  })
]);

export const apiSpecificationSyncSourceStateSchema = z.discriminatedUnion('state', [
  z.object({ state: z.literal('present'), source: apiSpecificationSyncSourceSchema }),
  z.object({
    state: z.literal('missing'),
    sourceKey: apiSpecificationSourceKeySchema
  })
]);

export const apiSpecificationSyncStatusSchema = z.enum(['created', 'updated', 'unchanged']);
export const apiSpecificationSourceStatusSchema = z.enum([
  'created',
  'updated',
  'unchanged',
  'queued',
  'link_only',
  'missing',
  'failed'
]);

export const apiSpecificationSyncBodySchema = z.object({
  entity: entityMutationBodySchema,
  source: apiSpecificationSyncSourceStateSchema.optional()
});

export const apiSpecificationSyncResultSchema = z.object({
  status: apiSpecificationSyncStatusSchema,
  entity: entityRecordSchema,
  sourceStatus: apiSpecificationSourceStatusSchema.nullable(),
  artifact: artifactSchema.nullable(),
  revision: artifactRevisionSchema.nullable(),
  requestId: z.string(),
  jobRunId: z.string().nullable(),
  warnings: z.array(z.string())
});

export const apiSpecificationRefreshResultSchema = z.object({
  status: z.enum(['queued', 'deduplicated']),
  artifact: artifactSchema,
  requestId: z.string(),
  jobRunId: z.string().nullable()
});

export const apiSpecificationSyncContract = oc.tag('Integrations').router({
  apiSpecificationSync: {
    syncByExternalKey: oc
      .route({
        method: 'PUT',
        path: '/integrations/v1/{workspace}/api-specifications/byExternalKey/{source}/{externalKey}',
        inputStructure: 'detailed',
        summary: 'Idempotently sync an API specification by external identity',
        description:
          'Creates or updates an API entity and its specification source in one repeatable operation. ' +
          'Source keys are provider-scoped and independent from internal database identifiers.',
        tags: ['Integrations']
      })
      .input(
        z.object({
          params: externalIdentityParamsSchema,
          body: apiSpecificationSyncBodySchema
        })
      )
      .output(apiSpecificationSyncResultSchema),
    refreshByExternalKey: oc
      .route({
        method: 'POST',
        path: '/integrations/v1/{workspace}/api-specifications/byExternalKey/{source}/{externalKey}/refresh',
        inputStructure: 'detailed',
        summary: 'Refresh an API specification source by external identity',
        description:
          'Queues a refresh for a URL-backed API specification without exposing internal entity or artifact identifiers.',
        tags: ['Integrations']
      })
      .input(
        z.object({
          params: externalIdentityParamsSchema,
          body: z.object({ sourceKey: apiSpecificationSourceKeySchema })
        })
      )
      .output(apiSpecificationRefreshResultSchema)
  }
});

export type ApiSpecificationSyncSource = z.infer<typeof apiSpecificationSyncSourceSchema>;
export type ApiSpecificationSyncSourceState = z.infer<typeof apiSpecificationSyncSourceStateSchema>;
export type ApiSpecificationSyncBody = z.infer<typeof apiSpecificationSyncBodySchema>;
export type ApiSpecificationSyncResult = z.infer<typeof apiSpecificationSyncResultSchema>;
