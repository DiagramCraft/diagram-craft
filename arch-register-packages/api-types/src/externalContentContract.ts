import { oc } from '@orpc/contract';
import { z } from 'zod';
import { ws } from '@arch-register/api-types/common';

const sourceTypeSchema = z.literal('git');
const scopeSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('workspace') }),
  z.object({ type: z.literal('project'), id: z.string() }),
  z.object({ type: z.literal('entity'), id: z.string() })
]);

const sourceConfigSchema = z.object({
  type: sourceTypeSchema,
  url: z.string().url()
});

const sourceSchema = z.object({
  id: z.string(),
  workspace: z.string(),
  source_type: sourceTypeSchema,
  source_config: sourceConfigSchema,
  enabled: z.boolean(),
  status: z.enum(['pending', 'syncing', 'succeeded', 'failed']),
  last_attempt_at: z.string().nullable(),
  last_synced_at: z.string().nullable(),
  last_revision: z.string().nullable(),
  last_error: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string()
});

const mountSchema = z.object({
  id: z.string(),
  workspace: z.string(),
  source_id: z.string(),
  scope: scopeSchema,
  destination_path: z.string(),
  source_path: z.string(),
  interval_hours: z.number().int().positive(),
  status: z.enum(['pending', 'syncing', 'succeeded', 'failed']),
  last_synced_at: z.string().nullable(),
  last_revision: z.string().nullable(),
  last_error: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  source: sourceSchema
});

export const externalContentContract = oc.tag('External Content').router({
  externalContent: {
    list: oc
      .route({
        method: 'GET',
        path: '/{workspace}/content-mounts',
        inputStructure: 'detailed',
        summary: 'List external content mounts',
        tags: ['External Content']
      })
      .input(z.object({ params: ws }))
      .output(z.array(mountSchema)),
    create: oc
      .route({
        method: 'POST',
        path: '/{workspace}/content-mounts',
        inputStructure: 'detailed',
        summary: 'Create an external content mount',
        tags: ['External Content']
      })
      .input(
        z.object({
          params: ws,
          body: z.object({
            source: sourceConfigSchema,
            scope: scopeSchema,
            destination_path: z
              .string()
              .trim()
              .min(1)
              .regex(/^[^/]+$/, 'Mount point must not contain /'),
            source_path: z.string().default(''),
            interval_hours: z.number().int().positive().default(1)
          })
        })
      )
      .output(mountSchema),
    update: oc
      .route({
        method: 'PUT',
        path: '/{workspace}/content-mounts/{id}',
        inputStructure: 'detailed',
        summary: 'Update an external content mount',
        tags: ['External Content']
      })
      .input(
        z.object({
          params: ws.extend({ id: z.string() }),
          body: z.object({
            source: sourceConfigSchema,
            destination_path: z
              .string()
              .trim()
              .min(1)
              .regex(/^[^/]+$/, 'Mount point must not contain /'),
            source_path: z.string().default(''),
            interval_hours: z.number().int().positive().default(1)
          })
        })
      )
      .output(mountSchema),
    remove: oc
      .route({
        method: 'DELETE',
        path: '/{workspace}/content-mounts/{id}',
        inputStructure: 'detailed',
        summary: 'Remove an external content mount',
        tags: ['External Content']
      })
      .input(z.object({ params: ws.extend({ id: z.string() }) }))
      .output(z.object({ success: z.boolean() })),
    sync: oc
      .route({
        method: 'POST',
        path: '/{workspace}/content-mounts/{id}/sync',
        inputStructure: 'detailed',
        summary: 'Queue an external content mount sync',
        tags: ['External Content']
      })
      .input(z.object({ params: ws.extend({ id: z.string() }) }))
      .output(z.object({ success: z.boolean(), run_id: z.string().nullable() }))
  }
});

export type ExternalContentMount = z.infer<typeof mountSchema>;
export type ExternalContentSource = z.infer<typeof sourceSchema>;
