import { EventEmitter } from 'node:events';
import type { IncomingHttpHeaders } from 'node:http';
import type { RequestOptions } from 'node:https';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { lookup } from 'node:dns/promises';
import { fetchUrlSource, MAX_URL_SOURCE_BYTES, UrlSourceFetchError } from './urlSourceFetcher';

const mocks = vi.hoisted(() => ({
  dnsLookup: vi.fn(),
  request: vi.fn()
}));

vi.mock('node:dns/promises', () => ({ lookup: mocks.dnsLookup }));
vi.mock('node:https', () => ({ request: mocks.request }));

type MockResponse = EventEmitter & {
  statusCode: number;
  headers: IncomingHttpHeaders;
  resume: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
};

type MockRequest = EventEmitter & {
  setTimeout: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
  end: ReturnType<typeof vi.fn>;
};

const response = (
  statusCode: number,
  headers: IncomingHttpHeaders = {},
  body: string | Buffer = ''
): MockResponse => {
  const result = Object.assign(new EventEmitter(), {
    statusCode,
    headers,
    resume: vi.fn(),
    destroy: vi.fn()
  }) as MockResponse;
  result.on('newListener', (event: string) => {
    if (event !== 'data' && event !== 'end') return;
    queueMicrotask(() => {
      if (event === 'data' && body.length > 0) result.emit('data', body);
      if (event === 'end') result.emit('end');
    });
  });
  return result;
};

const queueResponse = (next: MockResponse) => {
  mocks.request.mockImplementationOnce(
    (_options: RequestOptions, callback: (response: MockResponse) => void) => {
      const request = Object.assign(new EventEmitter(), {
        setTimeout: vi.fn(),
        destroy: vi.fn(),
        end: vi.fn()
      }) as MockRequest;
      queueMicrotask(() => callback(next));
      return request;
    }
  );
};

describe('URL source fetcher', () => {
  beforeEach(() => {
    mocks.dnsLookup.mockReset();
    mocks.request.mockReset();
    mocks.dnsLookup.mockResolvedValue([{ address: '203.0.113.10', family: 4 }] as never);
  });

  it('limits the response and pins HTTPS requests to the validated DNS address', async () => {
    queueResponse(
      response(200, { 'content-type': 'application/yaml', etag: '"spec-1"' }, 'openapi: 3.1.0\n')
    );

    await expect(
      fetchUrlSource('https://example.test/openapi.yaml', new AbortController().signal)
    ).resolves.toEqual({
      content: 'openapi: 3.1.0\n',
      mediaType: 'application/yaml',
      sourceRevision: '"spec-1"'
    });

    const requestOptions = mocks.request.mock.calls[0]?.[0] as RequestOptions;
    expect(requestOptions.servername).toBe('example.test');
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
    expect(resolved).toEqual({ address: '203.0.113.10', family: 4 });
  });

  it('rejects a DNS result containing a private address before making a request', async () => {
    mocks.dnsLookup.mockResolvedValue([
      { address: '203.0.113.10', family: 4 },
      { address: '10.0.0.10', family: 4 }
    ] as never);

    await expect(
      fetchUrlSource('https://example.test/openapi.yaml', new AbortController().signal)
    ).rejects.toMatchObject({
      category: 'security_blocked'
    });
    expect(mocks.request).not.toHaveBeenCalled();
  });

  it('revalidates every HTTPS redirect and enforces the size limit', async () => {
    queueResponse(response(302, { location: 'https://cdn.example.test/openapi.json' }));
    queueResponse(response(200, { 'content-type': 'application/json' }, '{"openapi":"3.1.0"}'));

    await expect(
      fetchUrlSource('https://example.test/openapi.json', new AbortController().signal)
    ).resolves.toMatchObject({ content: '{"openapi":"3.1.0"}' });
    expect(mocks.dnsLookup).toHaveBeenCalledTimes(2);
    expect(mocks.dnsLookup.mock.calls[0]?.[0]).toBe('example.test');
    expect(mocks.dnsLookup.mock.calls[1]?.[0]).toBe('cdn.example.test');

    mocks.request.mockReset();
    queueResponse(
      response(200, { 'content-length': String(MAX_URL_SOURCE_BYTES + 1) }, 'not read')
    );
    await expect(
      fetchUrlSource('https://example.test/openapi.json', new AbortController().signal)
    ).rejects.toMatchObject({
      category: 'source_too_large'
    } satisfies Partial<UrlSourceFetchError>);
  });

  it('rejects non-HTTPS sources and credentials', async () => {
    await expect(
      fetchUrlSource('http://example.test/openapi.json', new AbortController().signal)
    ).rejects.toMatchObject({ category: 'invalid_source' });
    await expect(
      fetchUrlSource('https://user:secret@example.test/openapi.json', new AbortController().signal)
    ).rejects.toMatchObject({ category: 'invalid_source' });
    expect(lookup).toBe(mocks.dnsLookup);
    expect(mocks.dnsLookup).not.toHaveBeenCalled();
  });
});
