import { createHmac, randomUUID } from 'node:crypto';
import type { DatabaseAdapter } from '../../db/database';
import type { AuditLogDbResult } from '../audit/db/auditDatabase';
import { enqueueOneOffJobRun } from '../jobs/jobOperations';
import { RetryableJobError } from '../jobs/jobRetry';
import { UnsafeOutboundHostError } from './webhookRequest';
import { sendWebhookRequest } from './webhookRequest';

const JOB_TYPE = 'webhook.delivery';
const SYSTEM_IDENTITY = 'webhooks';
const NEVER_ABORTED_SIGNAL = new AbortController().signal;

export type WebhookEvent = {
  version: '1';
  id: string;
  type: 'entity.created' | 'entity.updated' | 'entity.deleted';
  occurred_at: string;
  workspace_id: string;
  actor: { id: string | null; display_name: string | null };
  entity: { id: string; name: string; slug: string | null; schema_id: string | null };
  changes: AuditLogDbResult['changes'];
  metadata: Record<string, unknown>;
};

export const auditLogToWebhookEvent = (auditLog: AuditLogDbResult): WebhookEvent => ({
  version: '1',
  id: auditLog.id,
  type: `entity.${auditLog.operation}d` as WebhookEvent['type'],
  occurred_at: auditLog.timestamp.toISOString(),
  workspace_id: auditLog.workspace,
  actor: { id: auditLog.user_id, display_name: auditLog.user_display_name },
  entity: {
    id: auditLog.entity_id,
    name: auditLog.entity_name,
    slug: auditLog.entity_slug,
    schema_id: auditLog.schema_id
  },
  changes: auditLog.changes,
  metadata: auditLog.metadata
});

export const enqueueWebhookDeliveries = async (db: DatabaseAdapter, auditLog: AuditLogDbResult) => {
  if (auditLog.entity_type !== 'entity') return 0;
  const webhooks = await db.webhook.listWebhooks(auditLog.workspace);
  const matching = webhooks.filter(
    webhook =>
      webhook.enabled &&
      webhook.event_filter.operations.includes(auditLog.operation) &&
      (webhook.event_filter.schema_ids.length === 0 ||
        (auditLog.schema_id != null &&
          webhook.event_filter.schema_ids.includes(auditLog.schema_id)))
  );
  const event = auditLogToWebhookEvent(auditLog);
  for (const webhook of matching) {
    await enqueueOneOffJobRun(db, {
      id: randomUUID(),
      workspace: auditLog.workspace,
      jobType: JOB_TYPE,
      systemIdentity: SYSTEM_IDENTITY,
      payload: { webhookId: webhook.id, event },
      maxAttempts: 5
    });
  }
  return matching.length;
};

const retryAfterMs = (value: string | null, now = Date.now()) => {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return seconds * 1000;
  const date = new Date(value).getTime();
  return Number.isNaN(date) ? undefined : Math.max(0, date - now);
};

const isWebhookEvent = (value: unknown): value is WebhookEvent =>
  typeof value === 'object' &&
  value != null &&
  'version' in value &&
  value.version === '1' &&
  'id' in value &&
  typeof value.id === 'string' &&
  'type' in value &&
  typeof value.type === 'string';

export const createWebhookDeliveryHandler =
  (db: DatabaseAdapter) =>
  async (context: {
    jobId: string;
    workspace: string;
    payload: Record<string, unknown>;
    signal?: AbortSignal;
  }) => {
    const signal = context.signal ?? NEVER_ABORTED_SIGNAL;
    const webhookId = context.payload['webhookId'];
    const event = context.payload['event'];
    if (typeof webhookId !== 'string' || !isWebhookEvent(event)) {
      throw new Error('Webhook delivery job has an invalid payload');
    }
    const webhook = await db.webhook.getWebhook(context.workspace, webhookId);
    if (!webhook?.enabled) return { skipped: true };

    const body = JSON.stringify(event);
    const signature = createHmac('sha256', webhook.hmac_secret).update(body).digest('hex');
    let response: Awaited<ReturnType<typeof sendWebhookRequest>>;
    try {
      response = await sendWebhookRequest(new URL(webhook.url), {
        signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
        headers: {
          'content-type': 'application/json',
          'user-agent': 'Arch-Register-Webhooks/1.0',
          'x-arch-register-event': event.type,
          'x-arch-register-event-id': event.id,
          'x-arch-register-delivery-id': context.jobId,
          'x-arch-register-signature-256': `sha256=${signature}`
        },
        body
      });
    } catch (error) {
      if (error instanceof UnsafeOutboundHostError) throw error;
      throw new RetryableJobError(
        `Webhook request failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    if (response.status >= 200 && response.status < 300) {
      return { status_code: response.status };
    }
    const message = `Webhook returned HTTP ${response.status}`;
    if (response.status >= 300 && response.status < 400) {
      throw new Error(message);
    }
    if (response.status === 408 || response.status === 429 || response.status >= 500) {
      throw new RetryableJobError(
        message,
        response.status === 429 || response.status === 503
          ? retryAfterMs(response.retryAfter)
          : undefined
      );
    }
    throw new Error(message);
  };
