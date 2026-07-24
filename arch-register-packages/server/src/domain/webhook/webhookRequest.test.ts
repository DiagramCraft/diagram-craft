import { afterEach, describe, expect, it } from 'vitest';
import { sendWebhookRequest } from './webhookRequest';

const originalNodeEnv = process.env['NODE_ENV'];

afterEach(async () => {
  process.env['NODE_ENV'] = originalNodeEnv;
});

describe('sendWebhookRequest', () => {
  it('allows a private development destination past host safety checks', async () => {
    process.env['NODE_ENV'] = 'development';

    await expect(
      sendWebhookRequest(new URL('http://127.0.0.1:1/hook'), {
        body: '{}',
        headers: { 'content-type': 'application/json' },
        signal: new AbortController().signal
      })
    ).rejects.toMatchObject({
      code: expect.stringMatching(/^(ECONNREFUSED|EPERM)$/)
    });
  });

  it('rejects a private destination outside development before opening a request', async () => {
    process.env['NODE_ENV'] = 'test';

    await expect(
      sendWebhookRequest(new URL('https://127.0.0.1/hook'), {
        body: '{}',
        headers: {},
        signal: new AbortController().signal
      })
    ).rejects.toThrow('publicly routable');
  });
});
