import { ORPCError } from '@orpc/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchWithAuthResponse } from '../auth/authClient';
import { ApiError, apiFetchResponse, ensureApiResponse, normalizeApiError } from './http';

vi.mock('../auth/authClient', () => ({
  fetchWithAuthResponse: vi.fn()
}));

const fetchWithAuthResponseMock = vi.mocked(fetchWithAuthResponse);

describe('API error normalization', () => {
  beforeEach(() => {
    fetchWithAuthResponseMock.mockReset();
  });

  it.each([
    [401, 'UNAUTHORIZED'],
    [403, 'FORBIDDEN'],
    [409, 'CONFLICT'],
    [503, 'SERVICE_UNAVAILABLE']
  ] as const)('preserves status, code, and message from an oRPC %i error', (status, code) => {
    const source = new ORPCError(code, { status, message: `Server message ${status}` });

    const error = normalizeApiError(source);

    expect(error).toMatchObject({
      name: 'ApiError',
      kind: 'http',
      status,
      code,
      message: `Server message ${status}`,
      cause: source
    });
  });

  it('returns an existing ApiError unchanged', () => {
    const source = new ApiError(409, 'Already exists');

    expect(normalizeApiError(source)).toBe(source);
  });

  it('normalizes network failures without inventing an HTTP status', () => {
    const source = new TypeError('Failed to fetch');

    expect(normalizeApiError(source)).toMatchObject({
      kind: 'network',
      status: undefined,
      code: 'NETWORK_ERROR',
      message: 'Unable to reach the server. Check your connection and try again.',
      cause: source
    });
  });

  it('preserves the message of an unexpected transport error', () => {
    const source = new Error('Decoder failed');

    expect(normalizeApiError(source)).toMatchObject({
      kind: 'unknown',
      status: undefined,
      message: 'Decoder failed',
      cause: source
    });
  });

  it('extracts a JSON server message from a failed response', async () => {
    const response = new Response(JSON.stringify({ message: 'Conflict details' }), {
      status: 409,
      statusText: 'Conflict'
    });

    await expect(ensureApiResponse(response)).rejects.toMatchObject({
      kind: 'http',
      status: 409,
      message: 'Conflict details'
    });
  });

  it('uses text and status fallbacks for non-JSON and empty 5xx responses', async () => {
    await expect(
      ensureApiResponse(new Response('Upstream unavailable', { status: 502 }))
    ).rejects.toMatchObject({ status: 502, message: 'Upstream unavailable' });

    await expect(
      ensureApiResponse(new Response(null, { status: 503, statusText: 'Service Unavailable' }))
    ).rejects.toMatchObject({ status: 503, message: 'Service Unavailable' });
  });

  it('normalizes a rejected fetch and leaves the multipart content type to fetch', async () => {
    fetchWithAuthResponseMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const form = new FormData();
    form.append('file', new Blob(['contents']), 'file.txt');

    await expect(
      apiFetchResponse('/api/upload', { method: 'POST', body: form })
    ).rejects.toMatchObject({
      kind: 'network',
      code: 'NETWORK_ERROR'
    });
    const headers = fetchWithAuthResponseMock.mock.calls[0]?.[1]?.headers as Headers;
    expect(headers.has('Content-Type')).toBe(false);
  });
});
