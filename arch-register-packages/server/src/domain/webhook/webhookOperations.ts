import { randomBytes, randomUUID } from 'node:crypto';
import type { AuthenticatedEvent } from '../../middleware/auth';
import type { DatabaseAdapter } from '../../db/database';
import type {
  WebhookEventFilter,
  WebhookOperation
} from '@arch-register/api-types/webhookContract';
import { buildApiAuthCtx, requireWorkspaceAdmin } from '../auth/authorization';
import { resolveWorkspace } from '../workspace/resolveWorkspace';
import { httpAssert } from '../../utils/httpAssert';
import type { WorkspaceWebhookDbResult } from './db/webhookDatabase';

const generateSecret = () => `whsec_${randomBytes(32).toString('base64url')}`;

export const normalizeWebhookUrl = (value: string) => {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error('Webhook URL must be a valid URL');
  }
  httpAssert.true(url.protocol === 'https:' || url.protocol === 'http:', {
    status: 400,
    message: 'Webhook URL must use HTTPS'
  });
  httpAssert.true(!url.username && !url.password && !url.hash, {
    status: 400,
    message: 'Webhook URL must not contain credentials or a fragment'
  });
  if (url.protocol === 'http:') {
    const localHosts = new Set(['localhost', '127.0.0.1', '[::1]']);
    httpAssert.true(process.env['NODE_ENV'] !== 'production' && localHosts.has(url.hostname), {
      status: 400,
      message: 'Webhook URLs must use HTTPS; local HTTP is available only outside production'
    });
  }
  return url.toString();
};

const normalizeFilter = async (
  db: DatabaseAdapter,
  workspace: string,
  filter: WebhookEventFilter
): Promise<WebhookEventFilter> => {
  const operations = [...new Set(filter.operations)] as WebhookOperation[];
  httpAssert.true(operations.length > 0, {
    status: 400,
    message: 'At least one webhook operation is required'
  });
  const schemaIds = [...new Set(filter.schema_ids)];
  const schemas = await db.catalog.listSchemas(workspace);
  const available = new Set(schemas.map(schema => schema.id));
  httpAssert.true(
    schemaIds.every(id => available.has(id)),
    {
      status: 400,
      message: 'Webhook filter contains an entity type from another workspace'
    }
  );
  return { operations, schema_ids: schemaIds };
};

export const toApiWebhook = (webhook: WorkspaceWebhookDbResult) => ({
  id: webhook.id,
  workspace: webhook.workspace,
  url: webhook.url,
  event_filter: webhook.event_filter,
  enabled: webhook.enabled,
  created_at: webhook.created_at.toISOString(),
  updated_at: webhook.updated_at.toISOString()
});

const authorize = async (db: DatabaseAdapter, workspace: string, event: AuthenticatedEvent) => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  const authCtx = await buildApiAuthCtx(db, ws, event);
  requireWorkspaceAdmin(authCtx);
  return ws;
};

export const listWebhooks = async (
  db: DatabaseAdapter,
  workspace: string,
  event: AuthenticatedEvent
) => {
  const ws = await authorize(db, workspace, event);
  return (await db.webhook.listWebhooks(ws)).map(toApiWebhook);
};

export const createWebhook = async (
  db: DatabaseAdapter,
  workspace: string,
  input: { url: string; event_filter: WebhookEventFilter; enabled: boolean },
  event: AuthenticatedEvent
) => {
  const ws = await authorize(db, workspace, event);
  const now = new Date();
  const secret = generateSecret();
  const webhook = await db.webhook.createWebhook({
    id: randomUUID(),
    workspace: ws,
    url: normalizeWebhookUrl(input.url),
    event_filter: await normalizeFilter(db, ws, input.event_filter),
    hmac_secret: secret,
    enabled: input.enabled,
    created_at: now,
    updated_at: now
  });
  return { webhook: toApiWebhook(webhook), secret };
};

export const updateWebhook = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  input: { url: string; event_filter: WebhookEventFilter; enabled: boolean },
  event: AuthenticatedEvent
) => {
  const ws = await authorize(db, workspace, event);
  const existing = await db.webhook.getWebhook(ws, id);
  httpAssert.present(existing, { status: 404, message: 'Webhook not found' });
  const updated = await db.webhook.updateWebhook(ws, id, {
    url: normalizeWebhookUrl(input.url),
    event_filter: await normalizeFilter(db, ws, input.event_filter),
    hmac_secret: existing.hmac_secret,
    enabled: input.enabled,
    updated_at: new Date()
  });
  httpAssert.present(updated, { status: 404, message: 'Webhook not found' });
  return toApiWebhook(updated);
};

export const deleteWebhook = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  event: AuthenticatedEvent
) => {
  const ws = await authorize(db, workspace, event);
  httpAssert.true(await db.webhook.deleteWebhook(ws, id), {
    status: 404,
    message: 'Webhook not found'
  });
  return { success: true };
};

export const rotateWebhookSecret = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  event: AuthenticatedEvent
) => {
  const ws = await authorize(db, workspace, event);
  const existing = await db.webhook.getWebhook(ws, id);
  httpAssert.present(existing, { status: 404, message: 'Webhook not found' });
  const secret = generateSecret();
  const updated = await db.webhook.updateWebhook(ws, id, {
    url: existing.url,
    event_filter: existing.event_filter,
    hmac_secret: secret,
    enabled: existing.enabled,
    updated_at: new Date()
  });
  httpAssert.present(updated, { status: 404, message: 'Webhook not found' });
  return { webhook: toApiWebhook(updated), secret };
};
