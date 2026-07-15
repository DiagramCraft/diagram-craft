import { oc } from '@orpc/contract';
import { z } from 'zod';
import { ws } from '@arch-register/api-types/common';

export const webhookOperationSchema = z.enum(['create', 'update', 'delete']);

export const webhookEventFilterSchema = z.object({
  operations: z.array(webhookOperationSchema).min(1),
  schema_ids: z.array(z.string())
});

const webhookSchema = z.object({
  id: z.string(),
  workspace: z.string(),
  url: z.string().url(),
  event_filter: webhookEventFilterSchema,
  enabled: z.boolean(),
  created_at: z.string(),
  updated_at: z.string()
});

const webhookInputSchema = z.object({
  url: z.string().trim().url(),
  event_filter: webhookEventFilterSchema,
  enabled: z.boolean().default(true)
});

const webhookWithSecretSchema = z.object({
  webhook: webhookSchema,
  secret: z.string()
});

export const webhookContract = oc.tag('Webhooks').router({
  webhooks: {
    list: oc
      .route({
        method: 'GET',
        path: '/{workspace}/webhooks',
        inputStructure: 'detailed',
        tags: ['Webhooks']
      })
      .input(z.object({ params: ws }))
      .output(z.array(webhookSchema)),
    create: oc
      .route({
        method: 'POST',
        path: '/{workspace}/webhooks',
        inputStructure: 'detailed',
        tags: ['Webhooks']
      })
      .input(z.object({ params: ws, body: webhookInputSchema }))
      .output(webhookWithSecretSchema),
    update: oc
      .route({
        method: 'PUT',
        path: '/{workspace}/webhooks/{id}',
        inputStructure: 'detailed',
        tags: ['Webhooks']
      })
      .input(z.object({ params: ws.extend({ id: z.string() }), body: webhookInputSchema }))
      .output(webhookSchema),
    remove: oc
      .route({
        method: 'DELETE',
        path: '/{workspace}/webhooks/{id}',
        inputStructure: 'detailed',
        tags: ['Webhooks']
      })
      .input(z.object({ params: ws.extend({ id: z.string() }) }))
      .output(z.object({ success: z.boolean() })),
    rotateSecret: oc
      .route({
        method: 'POST',
        path: '/{workspace}/webhooks/{id}/rotate-secret',
        inputStructure: 'detailed',
        tags: ['Webhooks']
      })
      .input(z.object({ params: ws.extend({ id: z.string() }) }))
      .output(webhookWithSecretSchema)
  }
});

export type Webhook = z.infer<typeof webhookSchema>;
export type WebhookEventFilter = z.infer<typeof webhookEventFilterSchema>;
export type WebhookOperation = z.infer<typeof webhookOperationSchema>;
