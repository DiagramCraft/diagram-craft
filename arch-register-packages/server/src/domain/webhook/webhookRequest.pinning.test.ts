import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RequestOptions } from 'node:http';
import { lookup } from 'node:dns/promises';
import { sendWebhookRequest } from './webhookRequest';

const mocks = vi.hoisted(() => ({
  dnsLookup: vi.fn(),
  request: vi.fn()
}));

vi.mock('node:dns/promises', () => ({ lookup: mocks.dnsLookup }));
vi.mock('node:http', () => ({ request: mocks.request }));
vi.mock('node:https', () => ({ request: mocks.request }));

const lookupMock = vi.mocked(lookup);

describe('sendWebhookRequest DNS pinning', () => {
  beforeEach(() => {
    process.env['NODE_ENV'] = 'test';
    lookupMock.mockReset();
    lookupMock.mockResolvedValue([{ address: '8.8.8.8', family: 4 }] as never);
    mocks.request.mockReset();
    mocks.request.mockImplementation((_options, callback) => {
      queueMicrotask(() => callback({ statusCode: 204, headers: {}, resume: vi.fn() }));
      return {
        setTimeout: vi.fn(),
        once: vi.fn(),
        end: vi.fn()
      };
    });
  });

  it('pins the connection lookup to the validated address', async () => {
    await expect(
      sendWebhookRequest(new URL('https://example.test/hook'), {
        body: '{}',
        headers: {},
        signal: new AbortController().signal
      })
    ).resolves.toMatchObject({ status: 204 });

    const requestOptions = mocks.request.mock.calls[0]?.[0] as RequestOptions;
    expect(requestOptions.lookup).toBeDefined();
    const resolved = await new Promise<{ address: string; family: number }>((resolve, reject) => {
      requestOptions.lookup?.('example.test', {}, (error, address, family) => {
        if (error) {
          reject(error);
          return;
        }
        if (typeof address !== 'string' || family == null) {
          reject(new Error('lookup did not return a single address'));
          return;
        }
        resolve({ address, family });
      });
    });
    expect(resolved).toEqual({ address: '8.8.8.8', family: 4 });
  });
});
