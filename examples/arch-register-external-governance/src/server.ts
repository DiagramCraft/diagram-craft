import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  createServer as createHttpServer,
  type IncomingMessage,
  type ServerResponse
} from 'node:http';
import { ArchRegisterClient } from './archRegister.js';
import type { Config } from './config.js';
import { processWebhookEvent, type GovernanceWebhookEvent } from './integration.js';

const MAX_BODY_BYTES = 1_000_000;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

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

export const parseWebhookEvent = (body: Buffer): GovernanceWebhookEvent => {
  let value: unknown;
  try {
    value = JSON.parse(body.toString('utf8'));
  } catch {
    throw new Error('Webhook body is not valid JSON');
  }

  if (!isRecord(value)) throw new Error('Webhook event must be an object');
  const governance = value['governance'];
  const caseValue = isRecord(governance) ? governance['case'] : null;

  if (
    value['version'] !== '1' ||
    typeof value['id'] !== 'string' ||
    value['type'] !== 'governance.workflow.started' ||
    value['operation'] !== 'governance.workflow.started' ||
    !isRecord(governance) ||
    !isRecord(caseValue) ||
    typeof caseValue['id'] !== 'string' ||
    typeof caseValue['external'] !== 'boolean'
  ) {
    throw new Error('Invalid Arch Register governance webhook event');
  }

  return value as unknown as GovernanceWebhookEvent;
};

export const createServer = (
  config: Config,
  client: ArchRegisterClient = new ArchRegisterClient(config)
) => {
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
      const event = parseWebhookEvent(body);
      const result = await processWebhookEvent(event, config, client);
      console.log(JSON.stringify({ event_id: event.id, result }));
      send(response, 204);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(JSON.stringify({ error: message }));
      const status =
        message === 'Webhook body is too large'
          ? 413
          : message.startsWith('Invalid') || message.includes('not valid JSON')
            ? 400
            : 500;
      send(response, status);
    }
  });
};
