import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import type { Config } from './config.js';
import { createServer, parseWebhookEvent, verifySignature } from './server.js';

const config: Config = {
  host: '127.0.0.1',
  port: 3070,
  archRegisterUrl: 'http://arch-register.test',
  workspace: 'default',
  archRegisterToken: 'ar_pat_test',
  webhookSecret: 'whsec_test',
  targetCapability: 'ws.settings',
  assignmentAction: 'approve',
  autoDecision: 'none',
  decisionReason: 'External policy review'
};

const eventBody = JSON.stringify({
  version: '1',
  id: 'event-1',
  type: 'governance.workflow.started',
  operation: 'governance.workflow.started',
  governance: { case: { id: 'case-1', external: true } }
});

const signatureFor = (body: string): string =>
  `sha256=${createHmac('sha256', config.webhookSecret).update(body).digest('hex')}`;

const listen = async (server: ReturnType<typeof createServer>): Promise<string> => {
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  return `http://127.0.0.1:${address.port}`;
};

const close = async (server: ReturnType<typeof createServer>): Promise<void> => {
  await new Promise<void>((resolve, reject) =>
    server.close(error => (error ? reject(error) : resolve()))
  );
};

test('parses a workflow-started governance webhook', () => {
  const event = parseWebhookEvent(
    Buffer.from(
      JSON.stringify({
        version: '1',
        id: 'event-1',
        type: 'governance.workflow.started',
        operation: 'governance.workflow.started',
        governance: { case: { id: 'case-1', external: true } }
      })
    )
  );

  assert.equal(event.id, 'event-1');
  assert.equal(event.governance.case.id, 'case-1');
});

test('rejects malformed governance events and verifies signatures', async () => {
  assert.throws(
    () => parseWebhookEvent(Buffer.from(JSON.stringify({ version: '1', id: 'event-1' }))),
    /Invalid Arch Register governance webhook event/
  );

  const body = Buffer.from('{"id":"event-1"}');
  const signature = createHmac('sha256', 'whsec_test').update(body).digest('hex');
  assert.equal(verifySignature(body, `sha256=${signature}`, 'whsec_test'), true);
  assert.equal(verifySignature(body, `sha256=${'0'.repeat(64)}`, 'whsec_test'), false);
});

test('serves health checks and accepts signed webhook events', async () => {
  const calls: string[] = [];
  const client = {
    createInboxItem: async (...args: unknown[]) => {
      calls.push(JSON.stringify(args));
      return { assignment: { id: 'assignment-1' }, case: { id: 'case-1' } };
    },
    decideInboxItem: async () => {
      throw new Error('not expected');
    }
  } as never;
  const server = createServer(config, client);
  const baseUrl = await listen(server);

  try {
    const health = await fetch(`${baseUrl}/health`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { ok: true });

    const webhook = await fetch(`${baseUrl}/webhook`, {
      method: 'POST',
      headers: { 'x-arch-register-signature-256': signatureFor(eventBody) },
      body: eventBody
    });
    assert.equal(webhook.status, 204);
    assert.equal(calls.length, 1);
  } finally {
    await close(server);
  }
});

test('rejects invalid signatures and returns retryable failures as 500', async () => {
  const client = {
    createInboxItem: async () => {
      throw new Error('temporary Arch Register failure');
    }
  } as never;
  const server = createServer(config, client);
  const baseUrl = await listen(server);

  try {
    const unauthorized = await fetch(`${baseUrl}/webhook`, {
      method: 'POST',
      headers: { 'x-arch-register-signature-256': 'sha256=invalid' },
      body: eventBody
    });
    assert.equal(unauthorized.status, 401);

    const failed = await fetch(`${baseUrl}/webhook`, {
      method: 'POST',
      headers: { 'x-arch-register-signature-256': signatureFor(eventBody) },
      body: eventBody
    });
    assert.equal(failed.status, 500);

    const malformedBody = '{"version":"1"}';
    const malformed = await fetch(`${baseUrl}/webhook`, {
      method: 'POST',
      headers: { 'x-arch-register-signature-256': signatureFor(malformedBody) },
      body: malformedBody
    });
    assert.equal(malformed.status, 400);
  } finally {
    await close(server);
  }
});
