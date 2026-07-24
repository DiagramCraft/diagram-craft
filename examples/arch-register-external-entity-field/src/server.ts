import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  createServer as createHttpServer,
  type IncomingMessage,
  type ServerResponse
} from 'node:http';
import { ArchRegisterClient } from './archRegister.js';
import type { Config } from './config.js';
import { processWebhookEvent, type WebhookEvent } from './integration.js';

const MAX_BODY_BYTES = 1_000_000;

const send = (response: ServerResponse, status: number, body?: string) => {
  response.writeHead(status, body ? { 'content-type': 'application/json' } : undefined);
  response.end(body);
};

const readBody = async (request: IncomingMessage): Promise<Buffer> => {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk as Uint8Array);
    size += buffer.length;
    if (size > MAX_BODY_BYTES) throw new Error('Webhook body is too large');
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
};

export const verifySignature = (
  body: Buffer,
  header: string | undefined,
  secret: string
): boolean => {
  if (!header?.startsWith('sha256=')) return false;
  const expected = Buffer.from(createHmac('sha256', secret).update(body).digest('hex'));
  const actual = Buffer.from(header.slice('sha256='.length));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
};

const parseEvent = (body: Buffer): WebhookEvent => {
  const value: unknown = JSON.parse(body.toString('utf8'));
  const event =
    typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
  const entity =
    event && typeof event['entity'] === 'object' && event['entity'] !== null
      ? (event['entity'] as Record<string, unknown>)
      : null;
  if (
    event === null ||
    event['version'] !== '1' ||
    typeof event['id'] !== 'string' ||
    (event['type'] !== 'entity.created' &&
      event['type'] !== 'entity.updated' &&
      event['type'] !== 'entity.deleted') ||
    entity === null ||
    typeof entity['id'] !== 'string'
  ) {
    throw new Error('Invalid Arch Register webhook event');
  }
  return event as unknown as WebhookEvent;
};

export const createServer = (config: Config) => {
  const client = new ArchRegisterClient(config);
  return createHttpServer(async (request, response) => {
    if (request.method === 'GET' && request.url === '/health') {
      send(response, 200, JSON.stringify({ ok: true }));
      return;
    }
    if (request.method !== 'POST' || request.url !== '/webhook') {
      send(response, 404);
      return;
    }

    try {
      const body = await readBody(request);
      if (
        !verifySignature(
          body,
          request.headers['x-arch-register-signature-256'] as string | undefined,
          config.webhookSecret
        )
      ) {
        send(response, 401);
        return;
      }
      const event = parseEvent(body);
      const result = await processWebhookEvent(event, config, client);
      console.log(JSON.stringify({ event_id: event.id, entity_id: event.entity.id, result }));
      send(response, 204);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(JSON.stringify({ error: message }));
      send(response, message === 'Webhook body is too large' ? 413 : 500);
    }
  });
};
